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

	// Create users table
	createUsersTableSQL := `
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		email VARCHAR(255) UNIQUE NOT NULL,
		password VARCHAR(255) NOT NULL,
		name VARCHAR(255) NOT NULL,
		role VARCHAR(50) NOT NULL DEFAULT 'seller',
		avatar VARCHAR(500),
		bio TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
	`

	if _, err := db.Exec(createUsersTableSQL); err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}

	log.Println("Successfully created users table")

	// Create products table (software & ebooks)
	createProductsTableSQL := `
	CREATE TABLE IF NOT EXISTS products (
		id SERIAL PRIMARY KEY,
		seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		price INTEGER NOT NULL,
		original_price INTEGER,
		image VARCHAR(500),
		category VARCHAR(100),
		product_type VARCHAR(50) NOT NULL DEFAULT 'software',
		version VARCHAR(50),
		download_url VARCHAR(500),
		file_size VARCHAR(50),
		license_key VARCHAR(255),
		description TEXT,
		features TEXT,
		system_requirements TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
	CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
	CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
	`

	if _, err := db.Exec(createProductsTableSQL); err != nil {
		return fmt.Errorf("failed to create products table: %w", err)
	}

	log.Println("Successfully created products table")

	// Drop existing cart table if it exists (old schema without user_id)
	// Then create new cart table with user_id support
	dropCartSQL := `DROP TABLE IF EXISTS cart CASCADE;`
	if _, err := db.Exec(dropCartSQL); err != nil {
		log.Printf("Warning: Could not drop old cart table: %v", err)
	}

	// Create cart table
	createCartTableSQL := `
	CREATE TABLE IF NOT EXISTS cart (
		id SERIAL PRIMARY KEY,
		product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
		quantity INTEGER NOT NULL DEFAULT 1,
		session_id VARCHAR(255),
		user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_cart_product_id ON cart(product_id);
	CREATE INDEX IF NOT EXISTS idx_cart_session_id ON cart(session_id);
	CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
	`

	if _, err := db.Exec(createCartTableSQL); err != nil {
		return fmt.Errorf("failed to create cart table: %w", err)
	}

	log.Println("Successfully created cart table")
	return nil
}
