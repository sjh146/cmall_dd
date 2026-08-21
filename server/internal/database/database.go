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
		is_wallet_user BOOLEAN NOT NULL DEFAULT FALSE,
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

	// Create cart_sessions table (binds anonymous cart session_id to client IP)
	createCartSessionsTableSQL := `
	CREATE TABLE IF NOT EXISTS cart_sessions (
		session_id VARCHAR(255) PRIMARY KEY,
		client_ip VARCHAR(64) NOT NULL,
		guest_cookie VARCHAR(128) NOT NULL DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`

	if _, err := db.Exec(createCartSessionsTableSQL); err != nil {
		return fmt.Errorf("failed to create cart_sessions table: %w", err)
	}

	// CREATE TABLE IF NOT EXISTS does not alter an existing table, so add the
	// guest_cookie column idempotently for deployments that already have a
	// cart_sessions table without it. PostgreSQL supports ADD COLUMN IF NOT EXISTS.
	alterCartSessionsSQL := `
	ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS guest_cookie VARCHAR(128) NOT NULL DEFAULT '';
	`
	if _, err := db.Exec(alterCartSessionsSQL); err != nil {
		return fmt.Errorf("failed to add guest_cookie column to cart_sessions: %w", err)
	}

	log.Println("Successfully created cart_sessions table")

	// Create diaries table (guestbook-style trading diary)
	createDiariesTableSQL := `
		CREATE TABLE IF NOT EXISTS diaries (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
			title VARCHAR(255) NOT NULL,
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_diaries_user_id ON diaries(user_id);
		`

	if _, err := db.Exec(createDiariesTableSQL); err != nil {
		return fmt.Errorf("failed to create diaries table: %w", err)
	}
	log.Println("Successfully created diaries table")

	// Create diary_comments table
	createDiaryCommentsTableSQL := `
		CREATE TABLE IF NOT EXISTS diary_comments (
			id SERIAL PRIMARY KEY,
			diary_id INTEGER REFERENCES diaries(id) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_diary_comments_diary_id ON diary_comments(diary_id);
		CREATE INDEX IF NOT EXISTS idx_diary_comments_user_id ON diary_comments(user_id);
		`

	if _, err := db.Exec(createDiaryCommentsTableSQL); err != nil {
		return fmt.Errorf("failed to create diary_comments table: %w", err)
	}
	log.Println("Successfully created diary_comments table")

	// Create community_posts table (커뮤니티 — 전략 공유/소통 게시판)
	createCommunityPostsTableSQL := `
		CREATE TABLE IF NOT EXISTS community_posts (
			id SERIAL PRIMARY KEY,
			user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
			title VARCHAR(200) NOT NULL,
			content TEXT NOT NULL,
			category VARCHAR(20) NOT NULL DEFAULT '잡담',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
		`

	if _, err := db.Exec(createCommunityPostsTableSQL); err != nil {
		return fmt.Errorf("failed to create community_posts table: %w", err)
	}
	log.Println("Successfully created community_posts table")

	// Create community_comments table
	createCommunityCommentsTableSQL := `
		CREATE TABLE IF NOT EXISTS community_comments (
			id SERIAL PRIMARY KEY,
			post_id INTEGER REFERENCES community_posts(id) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);
		CREATE INDEX IF NOT EXISTS idx_community_comments_user ON community_comments(user_id);
		`

	if _, err := db.Exec(createCommunityCommentsTableSQL); err != nil {
		return fmt.Errorf("failed to create community_comments table: %w", err)
	}
	log.Println("Successfully created community_comments table")

	// Create lectures table
	createLecturesTableSQL := `
		CREATE TABLE IF NOT EXISTS lectures (
			id SERIAL PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			content TEXT,
			thumbnail VARCHAR(500),
			video_url VARCHAR(500),
			duration VARCHAR(50),
			instructor VARCHAR(255),
			is_published BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_lectures_published ON lectures(is_published);
		`

	if _, err := db.Exec(createLecturesTableSQL); err != nil {
		return fmt.Errorf("failed to create lectures table: %w", err)
	}
	log.Println("Successfully created lectures table")

	// Create notices table
	createNoticesTableSQL := `
		CREATE TABLE IF NOT EXISTS notices (
			id SERIAL PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			content TEXT NOT NULL,
			is_published BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_notices_published ON notices(is_published);
		`

	if _, err := db.Exec(createNoticesTableSQL); err != nil {
		return fmt.Errorf("failed to create notices table: %w", err)
	}
	log.Println("Successfully created notices table")

	// ── 결제 플랫폼 스키마 (M3: ZK 지갑/USDC 결제) ─────────────────────────

	// products에 USDC 결제가 컬럼 추가 (기존 price=KRW와 분리 — 단위 혼동 방지)
	alterProductsUSDC := `
	ALTER TABLE products ADD COLUMN IF NOT EXISTS crypto_price_usdc BIGINT NOT NULL DEFAULT 0;
	ALTER TABLE products ADD COLUMN IF NOT EXISTS request_type VARCHAR(32) NOT NULL DEFAULT 'stock_report';
	ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
	`
	if _, err := db.Exec(alterProductsUSDC); err != nil {
		return fmt.Errorf("failed to add crypto_price_usdc to products: %w", err)
	}

	// 지갑 전용 계정 구분 컬럼 (CWE-639: wallet.local 스쿼팅 방지 — 3차 스캔 대응)
	alterUsersWallet := `
	ALTER TABLE users ADD COLUMN IF NOT EXISTS is_wallet_user BOOLEAN NOT NULL DEFAULT FALSE;
	`
	if _, err := db.Exec(alterUsersWallet); err != nil {
		return fmt.Errorf("failed to add is_wallet_user to users: %w", err)
	}

	// M2: World ID 인간 증명 컬럼 (nullifier_hash UNIQUE = 1인 1계정, attributes JSONB = 검증된 속성만)
	alterWalletsM2 := `
	ALTER TABLE wallets ADD COLUMN IF NOT EXISTS nullifier_hash VARCHAR(255);
	ALTER TABLE wallets ADD COLUMN IF NOT EXISTS verification_level VARCHAR(16);
	ALTER TABLE wallets ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '[]';
	CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_nullifier ON wallets(nullifier_hash) WHERE nullifier_hash IS NOT NULL;
	`
	if _, err := db.Exec(alterWalletsM2); err != nil {
		return fmt.Errorf("failed to add M2 columns to wallets: %w", err)
	}

	// 지갑 (시크릿 무영속: 주소/credential_id/검증결과만 저장)
	createWalletsTableSQL := `
	CREATE TABLE IF NOT EXISTS wallets (
		id SERIAL PRIMARY KEY,
		user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		wallet_address VARCHAR(42) UNIQUE NOT NULL,
		credential_id VARCHAR(255),
		verification_result TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
	CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address ON wallets(wallet_address);
	`
	if _, err := db.Exec(createWalletsTableSQL); err != nil {
		return fmt.Errorf("failed to create wallets table: %w", err)
	}
	log.Println("Successfully created wallets table")

	// 인증 챌린지 (nonce — single-use, TTL)
	createAuthChallengesTableSQL := `
	CREATE TABLE IF NOT EXISTS auth_challenges (
		id SERIAL PRIMARY KEY,
		wallet_address VARCHAR(42) NOT NULL,
		nonce VARCHAR(128) UNIQUE NOT NULL,
		challenge_type VARCHAR(32) NOT NULL DEFAULT 'login',
		expires_at TIMESTAMP NOT NULL,
		used_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_auth_challenges_nonce ON auth_challenges(nonce);
	CREATE INDEX IF NOT EXISTS idx_auth_challenges_wallet ON auth_challenges(wallet_address);
	`
	if _, err := db.Exec(createAuthChallengesTableSQL); err != nil {
		return fmt.Errorf("failed to create auth_challenges table: %w", err)
	}
	log.Println("Successfully created auth_challenges table")

	// 결제 레코드 (amount_usdc = USDC 마이크로 단위, 6자리)
	createPaymentsTableSQL := `
	CREATE TABLE IF NOT EXISTS payments (
		id SERIAL PRIMARY KEY,
		user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		order_id INTEGER REFERENCES products(id),
		reference_id VARCHAR(128) UNIQUE NOT NULL,
		wallet_address VARCHAR(42) NOT NULL,
		amount_usdc BIGINT NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'pending',
		tx_hash VARCHAR(66),
		chain_id INTEGER NOT NULL DEFAULT 84532,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
	CREATE INDEX IF NOT EXISTS idx_payments_reference_id ON payments(reference_id);
	CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
	`
	if _, err := db.Exec(createPaymentsTableSQL); err != nil {
		return fmt.Errorf("failed to create payments table: %w", err)
	}
	log.Println("Successfully created payments table")

	// 구독
	createSubscriptionsTableSQL := `
	CREATE TABLE IF NOT EXISTS subscriptions (
		id SERIAL PRIMARY KEY,
		user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		plan VARCHAR(64) NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'active',
		expires_at TIMESTAMP,
		tx_hash VARCHAR(66),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
	`
	if _, err := db.Exec(createSubscriptionsTableSQL); err != nil {
		return fmt.Errorf("failed to create subscriptions table: %w", err)
	}
	log.Println("Successfully created subscriptions table")

	// 분석 요청
	createAnalysisRequestsTableSQL := `
	CREATE TABLE IF NOT EXISTS analysis_requests (
		id SERIAL PRIMARY KEY,
		user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		request_type VARCHAR(64) NOT NULL,
		symbol VARCHAR(32) NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'queued',
		result_json TEXT,
		internal_request_id VARCHAR(128),
		error TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_analysis_requests_user_id ON analysis_requests(user_id);
	CREATE INDEX IF NOT EXISTS idx_analysis_requests_status ON analysis_requests(status);
	`
	if _, err := db.Exec(createAnalysisRequestsTableSQL); err != nil {
		return fmt.Errorf("failed to create analysis_requests table: %w", err)
	}
	log.Println("Successfully created analysis_requests table")

	return nil
}
