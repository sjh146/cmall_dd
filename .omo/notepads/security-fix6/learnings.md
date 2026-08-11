# Security Fix 6 — Learnings

## Fix — [MEDIUM, CWE-209] PostgreSQL driver errors leaked verbatim in HTTP 500 responses

**Files:**
- `server/internal/handlers/errors.go` (NEW — shared helper)
- `server/internal/handlers/cart.go`
- `server/internal/handlers/products.go`
- `server/internal/handlers/diary.go`
- `server/internal/handlers/lecture.go`
- `server/internal/handlers/notice.go`
- `server/internal/handlers/auth.go`

**Vulnerability:** DB driver errors were returned verbatim to clients via
`c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})` after DB
operations. This leaks DBMS type, internal table names, and constraint names
(e.g. `pq: insert or update on table "cart" violates foreign key constraint
"cart_product_id_fkey"...`).

**Fix:**
- Created `respondDBError(c *gin.Context, err error)` in `errors.go`: logs the
  detailed error via `log.Printf("database error: %v", err)` and returns a
  generic `gin.H{"error": "Internal server error"}` 500 to the client.
- Replaced every DB-operation 500 that returned `err.Error()` with
  `respondDBError(c, err)` across all six handler files.
- In `AddToCart` (cart.go) INSERT path: detect a foreign-key violation via
  `strings.Contains(err.Error(), "violates foreign key constraint")` and return
  HTTP 400 with `"invalid product"`, logging the detail. Other DB errors use the
  generic 500 helper.

**Scope boundaries respected:**
- `ShouldBindJSON` 400 responses (`c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})`) left untouched — client input errors, not DB driver errors.
- `sql.ErrNoRows` → 404 branches (e.g. "Product not found", "Cart item not found") left untouched — already generic.
- 403 auth/ownership branches left untouched.
- All success paths (200/201) preserved exactly.

**Dependency note:** `github.com/lib/pq v1.10.9` is already in go.mod, but the
string-contains approach was used per instructions to avoid any new dependency
and keep the detection driver-agnostic.

## Verification
- `go vet ./...` passes (from `server/`).
- `go build ./...` passes (from `server/`).
- `go test ./...` passes (no test files).
- No frontend (`src/`) files modified. No docker/Jenkins/infra changes.
- No new dependencies added to go.mod/go.sum.
