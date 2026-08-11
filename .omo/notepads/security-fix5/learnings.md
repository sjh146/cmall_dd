# Security Fix 5 — Learnings

## Fix 1 — [MEDIUM, CWE-863] admin-only productType gate: case/whitespace bypass

**Files:** `server/internal/handlers/products.go`, `CreateProduct`

**Vulnerability:** The allowlist lookup `adminOnlyTypes[req.ProductType]` was
case-sensitive and did not trim whitespace, so a seller could bypass the
admin-only gate with `"Program"`, `"PROGRAM"`, `" program "`, `"Code"`, etc.

**Fix:**
- Compute `normalizedType := strings.ToLower(strings.TrimSpace(req.ProductType))`
  once near the top of the admin-only check.
- Use `adminOnlyTypes[normalizedType]` for the allowlist check.
- Use `normalizedType` in the INSERT statement (the `product_type` column) so
  the DB stays consistent with the enum (`program`/`code`/`instruction`/`diary`).
- Error message kept as-is.

**Regression verified:** admin normal type → 201; seller `diary` → 201; seller
`program` → 403; seller `"Program"`/`"PROGRAM"`/`" program "`/`"Code"` → 403.

## Fix 2 — [MEDIUM, CWE-639] anonymous cart sessionId: HttpOnly cookie binding

**Files:** `server/internal/handlers/cart.go`, `server/internal/database/database.go`

**Vulnerability:** Anonymous cart `sessionId` was client-controlled; IP binding
alone is useless against an attacker on the same IP/network. Added a
server-issued HttpOnly cookie binding without any frontend changes.

**Schema change (`database.go`):**
- `cart_sessions` CREATE TABLE now includes `guest_cookie VARCHAR(128) NOT NULL DEFAULT ''`.
- Added idempotent `ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS guest_cookie VARCHAR(128) NOT NULL DEFAULT ''`
  AFTER the CREATE TABLE (since `CREATE TABLE IF NOT EXISTS` does not alter an
  existing table) so existing deployments get the new column.

**Cookie logic (`cart.go`):**
- Cookie name `cmall_guest`, value = `crypto/rand` 32 bytes hex (64 hex chars).
- Set with `c.SetSameSite(http.SameSiteLaxMode)` + `c.SetCookie(name, value, 0, "/", "", false, true)` (HttpOnly).
- `verifyAnonymousSessionIP` now also reads `guest_cookie` from the row and calls
  `verifyAnonymousSessionCookie`.
- New helper `verifyAnonymousSessionCookie(c, db, sessionID, recordedGuestCookie) (bool, string)`:
  - recorded empty (legacy row) → generate new cookie, Set-Cookie, update row, allow (one-time migration).
  - cookie matches recorded → allow.
  - missing/mismatched → 403.
- `MergeCart` now also verifies the cookie (in addition to existing IP check),
  with the same legacy-row handling.
- Imports added to cart.go: `crypto/rand`, `encoding/hex` (`net/http` already present).
- Added the required same-origin nginx comment: real browsers go through
  same-origin nginx so the HttpOnly cookie is automatically maintained, hence
  normal flows are unaffected.

**Verification note:** A test that continues a session WITHOUT the cookie should
get 403 (expected/correct). `requests.Session()` receives Set-Cookie on first
request and auto-includes it on subsequent requests.

## Verification
- `go vet ./...` passes (from `server/`).
- `go build ./...` passes (from `server/`).
- No frontend (`src/`) files modified. No docker/Jenkins/infra changes.
- No new dependencies added to go.mod.

## Fix 2 follow-up — first-access cookie issuance bug

**Bug:** The FIRST-ACCESS branch in `verifyAnonymousSessionIP` (when
`err == sql.ErrNoRows`) only inserted `session_id` + `client_ip`, leaving
`guest_cookie` empty and returning `true` WITHOUT issuing the cookie. This meant:
1. No Set-Cookie header on the very first anonymous cart POST (cookie only issued
   on the second request via the legacy path).
2. The empty `guest_cookie` row was treated as "unbound" by the legacy path, so a
   no-cookie merge returned 200 instead of 403.

**Fix:** The first-access branch now:
1. Generates a new cookie via `generateGuestCookie()`.
2. Sets it on the response via `setGuestCookie(c, newValue)`.
3. Inserts the row WITH the cookie:
   `INSERT INTO cart_sessions (session_id, client_ip, guest_cookie) VALUES ($1, $2, $3)
    ON CONFLICT (session_id) DO UPDATE SET client_ip = EXCLUDED.client_ip, guest_cookie = EXCLUDED.guest_cookie`.
4. Returns `true`.

Now the very first anonymous access binds the cookie, and subsequent requests
without the matching cookie get 403. The legacy empty-cookie path in
`verifyAnonymousSessionCookie` now only applies to rows created before this fix
(rare, since new rows always get a cookie).

**MergeCart:** already calls `verifyAnonymousSessionCookie` with the recorded
`guest_cookie`; with non-empty cookies now guaranteed for new rows, a merge
without the matching cookie correctly returns 403.

**Verification:** `go vet ./...` and `go build ./...` pass from `server/`.
