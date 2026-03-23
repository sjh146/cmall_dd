# DevMall Backend API

A backend API server for Software & E-Books Marketplace.

## Tech Stack

- **Language**: Go 1.21+
- **Web Framework**: Gin
- **Database**: PostgreSQL with pgvector
- **ORM**: database/sql (standard library)

## Installation & Setup

### 1. Install Dependencies

```bash
go mod download
```

### 2. Environment Variables

Create `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=postgres
PORT=8080
JWT_SECRET=your_secret_key
```

### 3. Database Setup

Make sure PostgreSQL is running and pgvector extension is installed.

### 4. Run Server

```bash
go run main.go
```

Or build and run:

```bash
go build -o cmall_dd
./cmall_dd
```

Server runs on `http://localhost:8080`.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user

### Products
- `GET /api/v1/products` - Get all products
- `GET /api/v1/products/search` - Search products
- `GET /api/v1/products/:id` - Get single product
- `POST /api/v1/products` - Create product (auth required)
- `PUT /api/v1/products/:id` - Update product (auth required)
- `DELETE /api/v1/products/:id` - Delete product (auth required)
- `GET /api/v1/my-products` - Get seller's products (auth required)

### Cart
- `GET /api/v1/cart` - Get cart
- `POST /api/v1/cart` - Add to cart
- `PUT /api/v1/cart/:id` - Update cart item
- `DELETE /api/v1/cart/:id` - Remove from cart
- `POST /api/v1/cart/merge` - Merge session cart to user cart

### User
- `GET /api/v1/user` - Get current user (auth required)
- `PUT /api/v1/user` - Update user profile (auth required)

## Database Schema

### users table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| email | VARCHAR(255) | Unique email |
| password | VARCHAR(255) | Hashed password |
| name | VARCHAR(255) | Display name |
| role | VARCHAR(50) | User role |
| avatar | VARCHAR(500) | Profile image URL |
| bio | TEXT | User bio |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Update time |

### products table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| seller_id | INTEGER | FK to users |
| name | VARCHAR(255) | Product name |
| price | INTEGER | Price in cents |
| original_price | INTEGER | Original price |
| image | VARCHAR(500) | Image URL |
| category | VARCHAR(100) | Category |
| product_type | VARCHAR(50) | 'software' or 'ebook' |
| version | VARCHAR(50) | Version |
| download_url | VARCHAR(500) | Download link |
| file_size | VARCHAR(50) | File size |
| license_key | VARCHAR(255) | License key |
| description | TEXT | Description |
| features | TEXT | Features list |
| system_requirements | TEXT | System requirements |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Update time |

### cart table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| product_id | INTEGER | FK to products |
| quantity | INTEGER | Item quantity |
| session_id | VARCHAR(255) | Session ID |
| user_id | INTEGER | FK to users |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Update time |

## Project Structure

```
server/
├── main.go                 # Entry point
├── go.mod                  # Go module
├── .env                    # Environment variables
├── internal/
│   ├── database/          # DB connection & schema
│   ├── handlers/          # API handlers
│   ├── models/            # Data models
│   └── utils/             # Utilities
├── scripts/               # Helper scripts
└── README.md
```

## Database Backup & Restore

### Backup

**WSL:**
```bash
bash scripts/backup_database.sh
```

**PowerShell:**
```powershell
.\scripts\backup_database.ps1
```

### Restore

**WSL:**
```bash
bash scripts/restore_database.sh [backup_path]
```

**PowerShell:**
```powershell
.\scripts\restore_database.ps1 -BackupFile "path/to/backup.dump"
```

⚠️ **Warning**: Restore will overwrite existing data.
