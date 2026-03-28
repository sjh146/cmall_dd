# DevMall - Software & E-Books Marketplace

A modern marketplace for selling software and e-books. Built with Vite + React (frontend) and Go + Gin (backend).

## Features

- 🔐 **User Authentication** - JWT-based registration and login
- 💻 **Software Sales** - Sell downloadable software products
- 📚 **E-Book Sales** - Sell digital books
- 🛒 **Shopping Cart** - Session-based and user-based cart support
- 👤 **Seller Dashboard** - Manage your own products
- 🔍 **Product Search** - Search by name, type, and category

## Tech Stack

### Frontend
- Vite + React + TypeScript
- Tailwind CSS + Radix UI
- React Router v7

### Backend
- Go + Gin
- PostgreSQL with pgvector
- JWT Authentication

## Getting Started

### Prerequisites

- Node.js 18+
- Go 1.21+
- PostgreSQL 16+ with pgvector extension

### 1. Install Dependencies

```bash
npm install
cd server && go mod download
```

### 2. Configure Environment

Create `server/.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=postgres
PORT=8080
JWT_SECRET=your_secret_key
```

### 3. Run Backend

```bash
cd server
go run main.go
```

The backend will start on `http://localhost:8080`.

### 4. Run Frontend

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`.

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

### users
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| email | VARCHAR(255) | Unique email |
| password | VARCHAR(255) | Hashed password |
| name | VARCHAR(255) | Display name |
| role | VARCHAR(50) | User role (seller/admin) |
| avatar | VARCHAR(500) | Profile image URL |
| bio | TEXT | User bio |

### products
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| seller_id | INTEGER | FK to users |
| name | VARCHAR(255) | Product name |
| price | INTEGER | Price in cents |
| original_price | INTEGER | Original price |
| image | VARCHAR(500) | Product image URL |
| category | VARCHAR(100) | Product category |
| product_type | VARCHAR(50) | 'program', 'instruction', or 'diary' |
| version | VARCHAR(50) | Version/edition |
| download_url | VARCHAR(500) | Download link |
| file_size | VARCHAR(50) | File size |
| license_key | VARCHAR(255) | License key |
| description | TEXT | Product description |
| features | TEXT | JSON features list |
| system_requirements | TEXT | System requirements |

### cart
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| product_id | INTEGER | FK to products |
| quantity | INTEGER | Item quantity |
| session_id | VARCHAR(255) | Session identifier |
| user_id | INTEGER | FK to users |

## License

MIT
