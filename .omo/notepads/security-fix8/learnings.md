# security-fix8 Learnings

## Conventions (from prior Strix fixes)
- Backend: Go + Gin, `database/sql` (no ORM). Handlers in `server/internal/handlers/`.
- Models in `server/internal/models/models.go`. Product struct has `DownloadURL *string json:"downloadUrl,omitempty"` and `LicenseKey *string json:"licenseKey,omitempty"`.
- All SQL already uses parameterized `$N` placeholders (verified via grep). No raw string-concat SQL injection exists.
- Error responses use `respondDBError(c, err)` helper (generic, no driver detail — CWE-209 fixed in Strix 6차).
- Commit style: `fix(security): Strix N차 — <desc>`.
- Frontend (`src/`) must NOT be modified.
- Rebuild: `docker compose up -d --build backend`. Test: `docker compose run --rm test-go`.
- Local API: `http://localhost:8081`.

## Key facts
- `GetProducts` (products.go:14) and `GetProduct` (products.go:52) are PUBLIC (no auth) and return `download_url`/`license_key` → CWE-639.
- `GetMyProducts` (products.go:300), `CreateProduct`, `UpdateProduct` are authenticated seller-owner paths — these SHOULD keep downloadUrl/licenseKey.
- No separate purchase/download handler exists. Download is exposed via product detail fields.
- `MergeCart` (cart.go:438) already fully parameterized. sessionId format from frontend: `session_<timestamp>_<random>` (~30 chars).
- `CreateProduct`/`UpdateProduct` accept `downloadUrl` with no scheme validation → CWE-79 (javascript: XSS).
- sessionId validation: task requires length/format upper bound (e.g., 64 chars).

## Strix 8차 fixes (implemented)
- **Fix 1 (CWE-639)**: `GetProducts` now calls `stripSensitiveFields(&p)` on every row (public listing). `GetProduct` strips unless `userID == p.SellerID` (owner) or `userRole == "admin"`. `stripSensitiveFields` sets `DownloadURL`/`LicenseKey` to nil → omitted via `omitempty`.
- **Fix 2 (CWE-79)**: Added `validateDownloadURL(raw string) string` helper — `url.Parse` then requires `u.Scheme` be `http` or `https`, else returns error message. Called in `CreateProduct` and `UpdateProduct` when `req.DownloadURL != nil` → 400 on invalid scheme (javascript:/data:/vbscript:).
- **Fix 3 (CWE-89)**: All SQL already parameterized (verified). Added `validSessionID(sessionID string) bool` — non-empty, len ≤ 64, only alnum + `_` + `-`. Applied in `MergeCart`, `verifyAnonymousSessionIP`, and `verifyAnonymousCartOwnership` (request sessionId). Malformed → 400/403.
- `userId` from `c.Get("userId")` is an `int` (auth.go claims.UserID). Direct `userID == p.SellerID` interface-vs-int comparison works.
- Verification: `go build ./...` and `go vet ./...` both pass (go at /tmp/opencode/go/bin).

## Strix 8차 Fix 1 follow-up (seller-owner path broken)
- Root cause: `GET /products/:id` was on the PUBLIC `api` group with NO auth middleware, so `c.Get("userId")`/`c.Get("userRole")` were never set inside `GetProduct` → ownership check always false → fields always stripped even for the seller.
- Fix: `server/main.go` line 58 changed to `api.GET("/products/:id", handlers.OptionalAuthMiddleware(), handlers.GetProduct(db))`. `OptionalAuthMiddleware` sets userId/userRole when a valid Bearer token is present, else just calls `c.Next()` (unauthenticated still works). Only this route touched; other product routes unchanged.
- Verified: `go build ./...` and `go vet ./...` pass.

## Strix 8차 Fix 2 follow-up (UpdateProduct pre-existing 404 bug)
- Root cause: `UpdateProduct`'s `UPDATE` query had NO `RETURNING` clause, so `db.QueryRow(...).Scan(...)` always returned `sql.ErrNoRows` → handler always responded 404. Pre-existing bug (confirmed via git), but it broke the update flow Fix 2 requires.
- Fix: `server/internal/handlers/products.go` — after the `WHERE id = $N AND seller_id = $N+1` clause, appended `RETURNING id, seller_id, name, price, original_price, image, category, product_type, version, download_url, file_size, license_key, description, features, system_requirements, created_at, updated_at` (columns match the Scan targets exactly, same as CreateProduct). Dynamic SET-clause building and WHERE clause untouched.
- Verified: `go build ./...` and `go vet ./...` pass.
