# Strix Fix9 — Learnings

## Serialization paths for models.Product (grep-verified)
- products.go:
  - GetProducts (public) — ALREADY stripped via stripSensitiveFields (8차)
  - GetProduct (public, OptionalAuth) — stripped for non-owner/admin (8차)
  - CreateProduct (owner context) — KEEP (seller creating own product)
  - UpdateProduct (owner context) — KEEP
  - GetMyProducts (owner context) — KEEP (seller's own products)
  - SearchProducts (public) — NOT stripped, same class of vuln
- cart.go:
  - GetCart (OptionalAuth) — NOT stripped, THE reported vuln (embedded product objects)
- NO order/purchase handlers exist in this codebase → no legitimate buyer-download path to preserve.

## Task requirements
- Create public helper sanitizePublicProduct(p) (strips licenseKey/downloadUrl) — refactor from stripSensitiveFields
- Apply to GetCart embedded product objects
- Apply to ALL public serialization paths (search included)
- Keep owner-context paths (GetMyProducts, CreateProduct, UpdateProduct)
- Cart is a PUBLIC context (not a download-delivery path) → strip regardless of product ownership, even for seller's own product in cart

## Verification commands
- docker compose run --rm test-go (runs go vet ./... && go test ./...)
- Local API: http://localhost:8081
- Rebuild: docker compose up -d --build backend
