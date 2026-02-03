package models

import "time"

type Product struct {
	ID           int       `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Price        int       `json:"price" db:"price"`
	OriginalPrice *int     `json:"originalPrice,omitempty" db:"original_price"`
	Image        string    `json:"image" db:"image"`
	Category     string    `json:"category" db:"category"`
	Condition    string    `json:"condition" db:"condition"`
	Description  string    `json:"description" db:"description"`
	Size         *string   `json:"size,omitempty" db:"size"`
	Brand        *string   `json:"brand,omitempty" db:"brand"`
	Color        *string   `json:"color,omitempty" db:"color"`
	Material     *string   `json:"material,omitempty" db:"material"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

type CartItem struct {
	ID        int       `json:"id" db:"id"`
	ProductID int       `json:"productId" db:"product_id"`
	Product   *Product  `json:"product,omitempty"`
	Quantity  int       `json:"quantity" db:"quantity"`
	SessionID string    `json:"sessionId,omitempty" db:"session_id"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`
}

type CreateProductRequest struct {
	Name         string  `json:"name" binding:"required"`
	Price        int     `json:"price" binding:"required"`
	OriginalPrice *int   `json:"originalPrice,omitempty"`
	Image        string  `json:"image"`
	Category     string  `json:"category"`
	Condition    string  `json:"condition"`
	Description  string  `json:"description"`
	Size         *string `json:"size,omitempty"`
	Brand        *string `json:"brand,omitempty"`
	Color        *string `json:"color,omitempty"`
	Material     *string `json:"material,omitempty"`
}

type UpdateProductRequest struct {
	Name         *string `json:"name,omitempty"`
	Price        *int    `json:"price,omitempty"`
	OriginalPrice *int   `json:"originalPrice,omitempty"`
	Image        *string `json:"image,omitempty"`
	Category     *string `json:"category,omitempty"`
	Condition    *string `json:"condition,omitempty"`
	Description  *string `json:"description,omitempty"`
	Size         *string `json:"size,omitempty"`
	Brand        *string `json:"brand,omitempty"`
	Color        *string `json:"color,omitempty"`
	Material     *string `json:"material,omitempty"`
}

type AddToCartRequest struct {
	ProductID int `json:"productId" binding:"required"`
	Quantity  int `json:"quantity"`
	SessionID string `json:"sessionId,omitempty"`
}

