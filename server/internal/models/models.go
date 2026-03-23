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

// Product represents a software or ebook product
type Product struct {
	ID            int       `json:"id" db:"id"`
	SellerID      int       `json:"sellerId" db:"seller_id"`
	Name          string    `json:"name" db:"name"`
	Price         int       `json:"price" db:"price"`
	OriginalPrice *int      `json:"originalPrice,omitempty" db:"original_price"`
	Image         string    `json:"image" db:"image"`
	Category      string    `json:"category" db:"category"`
	ProductType   string    `json:"productType" db:"product_type"` // "software", "ebook"
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
	Price         int     `json:"price" binding:"required"`
	OriginalPrice *int    `json:"originalPrice,omitempty"`
	Image         string  `json:"image"`
	Category      string  `json:"category"`
	ProductType   string  `json:"productType" binding:"required"` // "software" or "ebook"
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
	Price         *int    `json:"price,omitempty"`
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
