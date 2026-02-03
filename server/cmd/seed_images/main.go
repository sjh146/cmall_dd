package main

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
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


var productMapping = map[string]ProductData{
	"frame_1-30.jpg": {
		Name:         "Celana Jeans Vintage Levi's 501",
		Price:        675000,
		OriginalPrice: intPtr(1335000),
		Category:      "pants",
		Condition:    "Good",
		Description:  "Celana jeans vintage Levi's 501 klasik dalam kondisi sangat baik",
		Size:         stringPtr("32W x 32L"),
		Brand:        stringPtr("Levi's"),
		Color:        stringPtr("blue"),
		Material:     stringPtr("denim"),
	},
	"frame_2-00.jpg": {
		Name:         "Kaos Band Vintage",
		Price:        375000,
		OriginalPrice: intPtr(600000),
		Category:      "shirts",
		Condition:    "Excellent",
		Description:  "Kaos band vintage asli, lembut dan nyaman",
		Size:         stringPtr("L"),
		Brand:        stringPtr("Hanes"),
		Color:        stringPtr("black"),
		Material:     stringPtr("cotton"),
	},
	"frame_2-30.jpg": {
		Name:         "Blazer Wol",
		Price:        825000,
		OriginalPrice: intPtr(2250000),
		Category:      "jackets",
		Condition:    "Good",
		Description:  "Blazer wol profesional, cocok untuk keperluan kantor",
		Size:         stringPtr("M"),
		Brand:        stringPtr("Brooks Brothers"),
		Color:        stringPtr("navy"),
		Material:     stringPtr("wool"),
	},
	"frame_3-00.jpg": {
		Name:         "Dress Musim Panas Motif Bunga",
		Price:        525000,
		OriginalPrice: intPtr(1200000),
		Category:      "dresses",
		Condition:    "Excellent",
		Description:  "Dress cantik dengan motif bunga untuk musim panas, ringan dan mengalir",
		Size:         stringPtr("S"),
		Brand:        stringPtr("Zara"),
		Color:        stringPtr("floral"),
		Material:     stringPtr("polyester"),
	},
	"frame_3-20.jpg": {
		Name:         "Celana Chino Khaki",
		Price:        420000,
		OriginalPrice: intPtr(975000),
		Category:      "pants",
		Condition:    "Good",
		Description:  "Celana chino khaki yang nyaman, cocok untuk pakaian kasual",
		Size:         stringPtr("34W x 30L"),
		Brand:        stringPtr("Gap"),
		Color:        stringPtr("khaki"),
		Material:     stringPtr("cotton"),
	},
	"frame_4-00.jpg": {
		Name:         "Sweater Oversized",
		Price:        480000,
		OriginalPrice: intPtr(1125000),
		Category:      "shirts",
		Condition:    "Excellent",
		Description:  "Sweater oversized yang hangat, sempurna untuk layering",
		Size:         stringPtr("M"),
		Brand:        stringPtr("H&M"),
		Color:        stringPtr("cream"),
		Material:     stringPtr("acrylic"),
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
	
	// Create word frequency map
	wordFreq := make(map[string]int)
	for _, word := range words {
		if len(word) > 2 { // Ignore very short words
			wordFreq[word]++
		}
	}
	
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
	
	// Check if product already exists
	var existingID int
	checkQuery := `SELECT id FROM cmall_dd WHERE image = $1`
	err := db.QueryRow(checkQuery, product.Image).Scan(&existingID)
	
	if err == nil {
		// Product exists, update embedding
		updateQuery := `UPDATE cmall_dd SET embedding = $1::vector WHERE id = $2`
		_, err := db.Exec(updateQuery, embeddingStr, existingID)
		if err != nil {
			return fmt.Errorf("failed to update embedding: %w", err)
		}
		log.Printf("Updated embedding for product ID %d: %s", existingID, product.Name)
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
	
	// Get images directory path
	imagesDir := os.Getenv("IMAGES_DIR")
	if imagesDir == "" {
		// Default to public/images relative to project root
		imagesDir = filepath.Join("..", "..", "public", "images")
	}
	
	log.Printf("Scanning images directory: %s", imagesDir)
	
	// Read image files
	files, err := os.ReadDir(imagesDir)
	if err != nil {
		log.Fatalf("Failed to read images directory: %v", err)
	}
	
	processed := 0
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		
		filename := file.Name()
		if !strings.HasSuffix(strings.ToLower(filename), ".jpg") {
			continue
		}
		
		// Extract frame identifier from filename
		var frameID string
		if strings.Contains(filename, "frame_1-30") {
			frameID = "frame_1-30.jpg"
		} else if strings.Contains(filename, "frame_2-00") {
			frameID = "frame_2-00.jpg"
		} else if strings.Contains(filename, "frame_2-30") {
			frameID = "frame_2-30.jpg"
		} else if strings.Contains(filename, "frame_3-00") {
			frameID = "frame_3-00.jpg"
		} else if strings.Contains(filename, "frame_3-20") {
			frameID = "frame_3-20.jpg"
		} else if strings.Contains(filename, "frame_4-00") {
			frameID = "frame_4-00.jpg"
		} else {
			log.Printf("Skipping unknown image: %s", filename)
			continue
		}
		
		product, exists := productMapping[frameID]
		if !exists {
			log.Printf("No product mapping for: %s", frameID)
			continue
		}
		
		// Set image path
		product.Image = "/images/" + filename
		
		log.Printf("Processing: %s -> %s", filename, product.Name)
		
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
		log.Printf("Successfully processed: %s\n", product.Name)
	}
	
	log.Printf("\nCompleted! Processed %d products", processed)
}

