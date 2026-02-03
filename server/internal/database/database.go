package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func InitDB() (*sql.DB, error) {
	// Database connection string
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
		dbname = "postgres"
	}

	// Build connection string
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	log.Printf("Connecting to database: host=%s port=%s dbname=%s", host, port, dbname)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Successfully connected to database")
	return db, nil
}

func CreateTables(db *sql.DB) error {
	// Enable pgvector extension
	if _, err := db.Exec("CREATE EXTENSION IF NOT EXISTS vector"); err != nil {
		log.Printf("Warning: Could not create vector extension (may already exist): %v", err)
	}

	// Create cmall_dd table (products table)
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS cmall_dd (
		id SERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		price INTEGER NOT NULL,
		original_price INTEGER,
		image VARCHAR(500),
		category VARCHAR(100),
		condition VARCHAR(50),
		description TEXT,
		size VARCHAR(50),
		brand VARCHAR(100),
		color VARCHAR(50),
		material VARCHAR(100),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		-- pgvector embedding for AI search (optional, can be added later)
		embedding vector(1536)
	);

	CREATE INDEX IF NOT EXISTS idx_cmall_dd_category ON cmall_dd(category);
	CREATE INDEX IF NOT EXISTS idx_cmall_dd_brand ON cmall_dd(brand);
	CREATE INDEX IF NOT EXISTS idx_cmall_dd_price ON cmall_dd(price);
	`

	if _, err := db.Exec(createTableSQL); err != nil {
		return fmt.Errorf("failed to create cmall_dd table: %w", err)
	}

	log.Println("Successfully created cmall_dd table")

	// Create cart table
	createCartTableSQL := `
	CREATE TABLE IF NOT EXISTS cart (
		id SERIAL PRIMARY KEY,
		product_id INTEGER REFERENCES cmall_dd(id) ON DELETE CASCADE,
		quantity INTEGER NOT NULL DEFAULT 1,
		session_id VARCHAR(255),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_cart_product_id ON cart(product_id);
	CREATE INDEX IF NOT EXISTS idx_cart_session_id ON cart(session_id);
	`

	if _, err := db.Exec(createCartTableSQL); err != nil {
		return fmt.Errorf("failed to create cart table: %w", err)
	}

	log.Println("Successfully created cart table")
	return nil
}

