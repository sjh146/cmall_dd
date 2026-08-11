# Security Fix Learnings

## Codebase Context (from exploration)

### Files to modify (all in server/internal/handlers/):
- `auth.go` — `SetUserAsAdmin` (CWE-862), `Register` (CWE-204)
- `cart.go` — `UpdateCartItem`, `RemoveFromCart` (CWE-639)
- `products.go` — `CreateProduct` (CWE-20)
- `models.go` — `CreateProductRequest` struct (CWE-20 validation tags)
- `main.go` — DELETE /cart/:id route lacks OptionalAuthMiddleware (needed for CWE-639 ownership check)

### Key patterns:
- Auth middleware sets `userId`, `userEmail`, `userRole` in gin context from JWT claims.
- Diary ownership pattern (diary.go): load owner_id from DB, compare `ownerID != userID.(int)` → 403.
- Cart routes use `OptionalAuthMiddleware` (except DELETE). `c.Get("userId")` returns `(value, hasUserID)`.
- `CartItem.UserID` is `*int` (nullable). Session carts have `user_id IS NULL`.
- `CreateProductRequest.Price` is `int` with `binding:"required"`.
- ADMIN_EMAIL env: register with that email → role=admin. Default `a@naver.com`.

### Route wiring (main.go):
- `api.PUT("/cart/:id", OptionalAuthMiddleware, UpdateCartItem)`
- `api.DELETE("/cart/:id", RemoveFromCart)` — NO auth middleware currently
- `protected.POST("/admin/set-admin", SetUserAsAdmin)` — behind AuthMiddleware

## Decisions
- CWE-862: Query DB for caller's role, only allow if role=="admin", else 403.
- CWE-639: When authenticated, load cart item, verify user_id == caller, else 403. Add OptionalAuthMiddleware to DELETE route.
- CWE-204: Return unified "Registration failed" message on duplicate email (keep 409 status).
- CWE-20: price >= 0 and <= 100,000,000 (1억). Add to CreateProduct (and UpdateProduct for defense-in-depth).
