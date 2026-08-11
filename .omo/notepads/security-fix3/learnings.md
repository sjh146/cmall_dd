# security-fix3 learnings

## VULN 1 (HIGH, CWE-639) GET /api/v1/diaries
- Moved `api.GET("/diaries", ...)` from public group into `protected` group in main.go (now uses AuthMiddleware).
- `GetDiaries` now reads `userId` from context and filters `WHERE d.user_id = $1`, passing userId as query arg.
- Response shape unchanged (id, userId, userName, title, content, createdAt, comments).

## VULN 2 (MEDIUM, CWE-639) cart DELETE/PUT anonymous bypass
- Added helper `verifyAnonymousCartOwnership(c, db, id)` in cart.go.
- It loads `user_id, session_id` from cart by id; 404 on no rows; 403 if account-owned (user_id valid & != 0); 403 if request sessionId empty/mismatch; else allow.
- Wired into both ownership-check blocks of `UpdateCartItem` (delete path + update path) and `RemoveFromCart` via `else` branch when `hasUserID == false`.
- Authenticated-path checks unchanged.

## Verification
- `go build ./...` and `go vet ./...` both exit 0 (go binary at /tmp/opencode/go/bin/go).
