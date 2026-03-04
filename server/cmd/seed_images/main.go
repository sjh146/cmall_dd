package main

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"log"
	"math"
	"os"
	"strings"
	"unicode"

	_ "github.com/lib/pq"
	"github.com/joho/godotenv"
)

type ProductData struct {
	Name         string
	Price        int
	OriginalPrice *int
	Image        string
	Category     string
	Condition    string
	Description  string
	Size         *string
	Brand        *string
	Color        *string
	Material     *string
}


// 10개 상품 데이터 정의
var products = []ProductData{
	// 1-6: 기존 이미지 사용
	{
		Name:         "Celana Jeans Vintage Levi's 501",
		Price:        675000,
		OriginalPrice: intPtr(1335000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_1-30.jpg",
		Category:     "pants",
		Condition:    "Good",
		Description:  "Celana jeans vintage Levi's 501 klasik dalam kondisi sangat baik",
		Size:         stringPtr("32W x 32L"),
		Brand:        stringPtr("Levi's"),
		Color:        stringPtr("blue"),
		Material:     stringPtr("denim"),
	},
	{
		Name:         "Kaos Band Vintage",
		Price:        375000,
		OriginalPrice: intPtr(600000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-00.jpg",
		Category:     "shirts",
		Condition:    "Excellent",
		Description:  "Kaos band vintage asli, lembut dan nyaman",
		Size:         stringPtr("L"),
		Brand:        stringPtr("Hanes"),
		Color:        stringPtr("black"),
		Material:     stringPtr("cotton"),
	},
	{
		Name:         "Blazer Wol Profesional",
		Price:        825000,
		OriginalPrice: intPtr(2250000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-30.jpg",
		Category:     "jackets",
		Condition:    "Good",
		Description:  "Blazer wol profesional, cocok untuk keperluan kantor",
		Size:         stringPtr("M"),
		Brand:        stringPtr("Brooks Brothers"),
		Color:        stringPtr("navy"),
		Material:     stringPtr("wool"),
	},
	{
		Name:         "Dress Musim Panas Motif Bunga",
		Price:        525000,
		OriginalPrice: intPtr(1200000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_3-00.jpg",
		Category:     "dresses",
		Condition:    "Excellent",
		Description:  "Dress cantik dengan motif bunga untuk musim panas, ringan dan mengalir",
		Size:         stringPtr("S"),
		Brand:        stringPtr("Zara"),
		Color:        stringPtr("floral"),
		Material:     stringPtr("polyester"),
	},
	{
		Name:         "Celana Chino Khaki",
		Price:        420000,
		OriginalPrice: intPtr(975000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_3-20.jpg",
		Category:     "pants",
		Condition:    "Good",
		Description:  "Celana chino khaki yang nyaman, cocok untuk pakaian kasual",
		Size:         stringPtr("34W x 30L"),
		Brand:        stringPtr("Gap"),
		Color:        stringPtr("khaki"),
		Material:     stringPtr("cotton"),
	},
	{
		Name:         "Sweater Oversized Hangat",
		Price:        480000,
		OriginalPrice: intPtr(1125000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_4-00.jpg",
		Category:     "shirts",
		Condition:    "Excellent",
		Description:  "Sweater oversized yang hangat, sempurna untuk layering",
		Size:         stringPtr("M"),
		Brand:        stringPtr("H&M"),
		Color:        stringPtr("cream"),
		Material:     stringPtr("acrylic"),
	},
	// 7-10: 이미지 재사용하여 다른 상품 정보로 생성
	{
		Name:         "Celana Jeans Slim Fit Hitam",
		Price:        750000,
		OriginalPrice: intPtr(1450000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_1-30.jpg",
		Category:     "pants",
		Condition:    "Excellent",
		Description:  "Celana jeans slim fit hitam modern, cocok untuk gaya kasual dan formal",
		Size:         stringPtr("30W x 32L"),
		Brand:        stringPtr("Uniqlo"),
		Color:        stringPtr("black"),
		Material:     stringPtr("denim"),
	},
	{
		Name:         "Kaos Polo Klasik Putih",
		Price:        295000,
		OriginalPrice: intPtr(550000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-00.jpg",
		Category:     "shirts",
		Condition:    "Good",
		Description:  "Kaos polo klasik putih, bahan berkualitas tinggi dan nyaman dipakai",
		Size:         stringPtr("M"),
		Brand:        stringPtr("Ralph Lauren"),
		Color:        stringPtr("white"),
		Material:     stringPtr("cotton"),
	},
	{
		Name:         "Dress Midi Elegan",
		Price:        650000,
		OriginalPrice: intPtr(1500000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_3-00.jpg",
		Category:     "dresses",
		Condition:    "Excellent",
		Description:  "Dress midi elegan dengan potongan yang menawan, cocok untuk acara formal",
		Size:         stringPtr("M"),
		Brand:        stringPtr("Mango"),
		Color:        stringPtr("navy"),
		Material:     stringPtr("polyester"),
	},
	{
		Name:         "Jaket Denim Vintage",
		Price:        890000,
		OriginalPrice: intPtr(1800000),
		Image:        "/images/🇰🇷🇷🇸Korean-Serbian Couple Q&A： Marriage, How We Met & Life Together ｜ 한국 세르비아인 커플_frame_2-30.jpg",
		Category:     "jackets",
		Condition:    "Good",
		Description:  "Jaket denim vintage dengan detail klasik, sempurna untuk gaya kasual",
		Size:         stringPtr("L"),
		Brand:        stringPtr("Levi's"),
		Color:        stringPtr("blue"),
		Material:     stringPtr("denim"),
	},
}

func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

// generateEmbedding creates a 1536-dimensional vector from text using hash-based approach
func generateEmbedding(text string) []float32 {
	// Normalize text: lowercase and remove special characters
	normalized := strings.ToLower(text)
	normalized = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsSpace(r) {
			return r
		}
		return ' '
	}, normalized)
	
	// Split into words
	words := strings.Fields(normalized)
	
	// Generate 1536-dimensional vector
	dimension := 1536
	embedding := make([]float32, dimension)
	
	// Use hash-based approach to fill the vector
	hash := sha256.Sum256([]byte(text))
	
	// Fill vector using hash and word frequencies
	for i := 0; i < dimension; i++ {
		// Use different parts of the hash for different dimensions
		hashIndex := i % len(hash)
		hashValue := float32(hash[hashIndex]) / 255.0 // Normalize to 0-1
		
		// Add word frequency influence
		wordIndex := i % len(words)
		if wordIndex < len(words) && len(words[wordIndex]) > 2 {
			wordHash := sha256.Sum256([]byte(words[wordIndex]))
			wordValue := float32(wordHash[hashIndex]) / 255.0
			hashValue = (hashValue + wordValue) / 2.0
		}
		
		// Normalize to -1 to 1 range
		embedding[i] = (hashValue - 0.5) * 2.0
	}
	
	// L2 normalization
	var sum float64
	for _, val := range embedding {
		sum += float64(val * val)
	}
	norm := float32(math.Sqrt(sum))
	if norm > 0 {
		for i := range embedding {
			embedding[i] /= norm
		}
	}
	
	return embedding
}

func buildEmbeddingText(product ProductData) string {
	parts := []string{product.Name}
	parts = append(parts, product.Category)
	if product.Brand != nil {
		parts = append(parts, *product.Brand)
	}
	if product.Color != nil {
		parts = append(parts, *product.Color)
	}
	if product.Material != nil {
		parts = append(parts, *product.Material)
	}
	parts = append(parts, product.Description)
	return strings.Join(parts, " ")
}

func insertProductWithEmbedding(db *sql.DB, product ProductData, embedding []float32) error {
	// Convert embedding to PostgreSQL vector format
	// pgvector expects format: [0.1,0.2,0.3,...]
	embeddingStr := "["
	for i, val := range embedding {
		if i > 0 {
			embeddingStr += ","
		}
		embeddingStr += fmt.Sprintf("%.6f", val)
	}
	embeddingStr += "]"
	
	// Check if product already exists by name
	var existingID int
	checkQuery := `SELECT id FROM cmall_dd WHERE name = $1`
	err := db.QueryRow(checkQuery, product.Name).Scan(&existingID)
	
	if err == nil {
		// Product exists, update embedding and other fields
		updateQuery := `UPDATE cmall_dd SET 
			price = $1, original_price = $2, image = $3, category = $4, 
			condition = $5, description = $6, size = $7, brand = $8, 
			color = $9, material = $10, embedding = $11::vector 
			WHERE id = $12`
		_, err := db.Exec(updateQuery,
			product.Price, product.OriginalPrice, product.Image, product.Category,
			product.Condition, product.Description, product.Size, product.Brand,
			product.Color, product.Material, embeddingStr, existingID)
		if err != nil {
			return fmt.Errorf("failed to update product: %w", err)
		}
		log.Printf("Updated product ID %d: %s", existingID, product.Name)
		return nil
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("failed to check existing product: %w", err)
	}
	
	// Insert new product
	query := `
		INSERT INTO cmall_dd (name, price, original_price, image, category, condition, 
		                      description, size, brand, color, material, embedding)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector)
		RETURNING id
	`
	
	var id int
	err = db.QueryRow(
		query,
		product.Name,
		product.Price,
		product.OriginalPrice,
		product.Image,
		product.Category,
		product.Condition,
		product.Description,
		product.Size,
		product.Brand,
		product.Color,
		product.Material,
		embeddingStr,
	).Scan(&id)
	
	if err != nil {
		return fmt.Errorf("failed to insert product: %w", err)
	}
	
	log.Printf("Inserted product ID %d: %s", id, product.Name)
	return nil
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}
	
	// Connect to database
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "postgres"
	}
	dbname := os.Getenv("DB_NAME")
	if dbname == "" {
		dbname = "cmall_dd"
	}
	
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)
	
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	
	log.Println("Connected to database successfully")
	
	log.Printf("Processing %d products...", len(products))
	
	processed := 0
	for i, product := range products {
		log.Printf("\n[%d/%d] Processing: %s", i+1, len(products), product.Name)
		log.Printf("Image: %s", product.Image)
		
		// Build embedding text
		embeddingText := buildEmbeddingText(product)
		log.Printf("Embedding text: %s", embeddingText)
		
		// Generate embedding locally
		log.Printf("Generating embedding locally...")
		embedding := generateEmbedding(embeddingText)
		log.Printf("Generated embedding with %d dimensions", len(embedding))
		
		// Insert into database
		if err := insertProductWithEmbedding(db, product, embedding); err != nil {
			log.Printf("Failed to insert product %s: %v", product.Name, err)
			continue
		}
		
		processed++
		log.Printf("Successfully processed: %s", product.Name)
	}
	
	log.Printf("\nCompleted! Processed %d products", processed)
}

