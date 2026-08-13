package models

import "time"

// User represents a registered user (seller)
type User struct {
	ID        int       `json:"id" db:"id"`
	Email     string    `json:"email" db:"email"`
	Password  string    `json:"-" db:"password"` // Never expose password in JSON
	Name      string    `json:"name" db:"name"`
	Role      string    `json:"role" db:"role"` // "seller", "admin"
	Avatar    *string   `json:"avatar,omitempty" db:"avatar"`
	Bio       *string   `json:"bio,omitempty" db:"bio"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// Product represents a trading product
type Product struct {
	ID            int       `json:"id" db:"id"`
	SellerID      int       `json:"sellerId" db:"seller_id"`
	Name          string    `json:"name" db:"name"`
	Price         int       `json:"price" db:"price"`
	OriginalPrice *int      `json:"originalPrice,omitempty" db:"original_price"`
	Image         string    `json:"image" db:"image"`
	Category      string    `json:"category" db:"category"`
	ProductType   string    `json:"productType" db:"product_type"` // "program", "diary"
	Version       *string   `json:"version,omitempty" db:"version"`
	DownloadURL   *string   `json:"downloadUrl,omitempty" db:"download_url"`
	FileSize      *string   `json:"fileSize,omitempty" db:"file_size"`
	LicenseKey    *string   `json:"licenseKey,omitempty" db:"license_key"`
	Description   string    `json:"description" db:"description"`
	Features      *string   `json:"features,omitempty" db:"features"` // JSON array of features
	SystemReq     *string   `json:"systemRequirements,omitempty" db:"system_requirements"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
}

// CartItem represents an item in the shopping cart
type CartItem struct {
	ID        int       `json:"id" db:"id"`
	ProductID int       `json:"productId" db:"product_id"`
	Product   *Product  `json:"product,omitempty"`
	Quantity  int       `json:"quantity" db:"quantity"`
	SessionID string    `json:"sessionId,omitempty" db:"session_id"`
	UserID    *int      `json:"userId,omitempty" db:"user_id"` // If logged in, use user_id
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

// ===== Request Models =====

// RegisterRequest is the request body for user registration
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

// LoginRequest is the request body for user login
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// CreateProductRequest is the request body for creating a product
type CreateProductRequest struct {
	Name          string  `json:"name" binding:"required"`
	Price         int     `json:"price" binding:"required,gte=0,lte=100000000"`
	OriginalPrice *int    `json:"originalPrice,omitempty"`
	Image         string  `json:"image"`
	Category      string  `json:"category"`
	ProductType   string  `json:"productType" binding:"required"` // "program" or "diary"
	Version       *string `json:"version,omitempty"`
	DownloadURL   *string `json:"downloadUrl,omitempty"`
	FileSize      *string `json:"fileSize,omitempty"`
	LicenseKey    *string `json:"licenseKey,omitempty"`
	Description   string  `json:"description"`
	Features      *string `json:"features,omitempty"`
	SystemReq     *string `json:"systemRequirements,omitempty"`
}

// UpdateProductRequest is the request body for updating a product
type UpdateProductRequest struct {
	Name          *string `json:"name,omitempty"`
	Price         *int    `json:"price,omitempty" binding:"omitempty,gte=0,lte=100000000"`
	OriginalPrice *int    `json:"originalPrice,omitempty"`
	Image         *string `json:"image,omitempty"`
	Category      *string `json:"category,omitempty"`
	ProductType   *string `json:"productType,omitempty"`
	Version       *string `json:"version,omitempty"`
	DownloadURL   *string `json:"downloadUrl,omitempty"`
	FileSize      *string `json:"fileSize,omitempty"`
	LicenseKey    *string `json:"licenseKey,omitempty"`
	Description   *string `json:"description,omitempty"`
	Features      *string `json:"features,omitempty"`
	SystemReq     *string `json:"systemRequirements,omitempty"`
}

// AddToCartRequest is the request body for adding to cart
type AddToCartRequest struct {
	ProductID int    `json:"productId" binding:"required"`
	Quantity  int    `json:"quantity"`
	SessionID string `json:"sessionId,omitempty"`
}

// AuthResponse is the response for successful authentication
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// Lecture represents an educational lecture
type Lecture struct {
	ID          int       `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description *string   `json:"description,omitempty" db:"description"`
	Content     *string   `json:"content,omitempty" db:"content"`
	Thumbnail   *string   `json:"thumbnail,omitempty" db:"thumbnail"`
	VideoURL    *string   `json:"videoUrl,omitempty" db:"video_url"`
	Duration    *string   `json:"duration,omitempty" db:"duration"`
	Instructor  *string   `json:"instructor,omitempty" db:"instructor"`
	IsPublished bool      `json:"isPublished" db:"is_published"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// Notice represents a system notice
type Notice struct {
	ID          int       `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Content     string    `json:"content" db:"content"`
	IsPublished bool      `json:"isPublished" db:"is_published"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// CreateLectureRequest is the request body for creating a lecture
type CreateLectureRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description,omitempty"`
	Content     *string `json:"content,omitempty"`
	Thumbnail   *string `json:"thumbnail,omitempty"`
	VideoURL    *string `json:"videoUrl,omitempty"`
	Duration    *string `json:"duration,omitempty"`
	Instructor  *string `json:"instructor,omitempty"`
	IsPublished *bool   `json:"isPublished,omitempty"`
}

// UpdateLectureRequest is the request body for updating a lecture
type UpdateLectureRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	Content     *string `json:"content,omitempty"`
	Thumbnail   *string `json:"thumbnail,omitempty"`
	VideoURL    *string `json:"videoUrl,omitempty"`
	Duration    *string `json:"duration,omitempty"`
	Instructor  *string `json:"instructor,omitempty"`
	IsPublished *bool   `json:"isPublished,omitempty"`
}

// CreateNoticeRequest is the request body for creating a notice
type CreateNoticeRequest struct {
	Title       string `json:"title" binding:"required"`
	Content     string `json:"content" binding:"required"`
	IsPublished *bool  `json:"isPublished,omitempty"`
}

// UpdateNoticeRequest is the request body for updating a notice
type UpdateNoticeRequest struct {
	Title       *string `json:"title,omitempty"`
	Content     *string `json:"content,omitempty"`
	IsPublished *bool   `json:"isPublished,omitempty"`
}

// ── 결제 플랫폼 모델 (M3: ZK 지갑/USDC 결제) ──────────────────────────────

// Wallet — 시크릿 무영속: 주소/credential_id/검증결과만 저장
type Wallet struct {
	ID                 int       `json:"id"`
	UserID             int       `json:"userId"`
	WalletAddress      string    `json:"walletAddress"`
	CredentialID       string    `json:"credentialId,omitempty"`
	VerificationResult string    `json:"verificationResult,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

// AuthChallenge — nonce 챌린지 (single-use, TTL)
type AuthChallenge struct {
	ID            int        `json:"id"`
	WalletAddress string     `json:"walletAddress"`
	Nonce         string     `json:"nonce"`
	ChallengeType string     `json:"challengeType"`
	ExpiresAt     time.Time  `json:"expiresAt"`
	UsedAt        *time.Time `json:"usedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// Payment — USDC 결제 레코드 (amount_usdc = 마이크로 단위, 6자리)
type Payment struct {
	ID            int       `json:"id"`
	UserID        int       `json:"userId"`
	OrderID       int       `json:"orderId"`
	ReferenceID   string    `json:"referenceId"`
	WalletAddress string    `json:"walletAddress"`
	AmountUsdc    int64     `json:"amountUsdc"`
	Status        string    `json:"status"` // pending | paid | failed
	TxHash        string    `json:"txHash,omitempty"`
	ChainID       int       `json:"chainId"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// Subscription — 구독
type Subscription struct {
	ID        int        `json:"id"`
	UserID    int        `json:"userId"`
	Plan      string     `json:"plan"`
	Status    string     `json:"status"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	TxHash    string     `json:"txHash,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

// AnalysisRequest — 분석 요청
type AnalysisRequest struct {
	ID                int       `json:"id"`
	UserID            int       `json:"userId"`
	RequestType       string    `json:"requestType"`
	Symbol            string    `json:"symbol"`
	Status            string    `json:"status"` // queued | running | done | failed
	ResultJSON        string    `json:"resultJson,omitempty"`
	InternalRequestID string    `json:"internalRequestId,omitempty"`
	Error             string    `json:"error,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// ── 요청/응답 타입 ───────────────────────────────────────────────────────

type NonceRequest struct {
	WalletAddress string `json:"walletAddress" binding:"required"`
}

type NonceResponse struct {
	Nonce     string `json:"nonce"`
	Message   string `json:"message"`
	ExpiresIn int    `json:"expiresIn"`
}

type VerifyRequest struct {
	WalletAddress string `json:"walletAddress" binding:"required"`
	Signature     string `json:"signature" binding:"required"`
	Nonce         string `json:"nonce" binding:"required"`
}

type WalletAuthResponse struct {
	Token         string `json:"token"`
	WalletAddress string `json:"walletAddress"`
	User          User   `json:"user"`
}

type CreatePaymentRequest struct {
	ProductID int `json:"productId" binding:"required"`
	// PayerMode "operator": MetaMask 없는 사용자 — 운영자 지갑이 결제 대행 (dev 전용).
	// create 시 payer=운영자로 등록되며, dev-pay로 운영자 키가 approve+pay를 실행한다.
	PayerMode string `json:"payerMode"`
}

type PaymentResponse struct {
	Payment
	ContractAddress string `json:"contractAddress,omitempty"`
	TokenAddress    string `json:"tokenAddress,omitempty"`
}

type CreateAnalysisRequest struct {
	Symbol      string `json:"symbol" binding:"required"`
	RequestType string `json:"requestType" binding:"required"`
}
