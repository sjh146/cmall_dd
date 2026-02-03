-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create cmall_dd table (products)
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cmall_dd_category ON cmall_dd(category);
CREATE INDEX IF NOT EXISTS idx_cmall_dd_brand ON cmall_dd(brand);
CREATE INDEX IF NOT EXISTS idx_cmall_dd_price ON cmall_dd(price);
CREATE INDEX IF NOT EXISTS idx_cmall_dd_condition ON cmall_dd(condition);

-- Create cart table
CREATE TABLE IF NOT EXISTS cart (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES cmall_dd(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for cart
CREATE INDEX IF NOT EXISTS idx_cart_product_id ON cart(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_session_id ON cart(session_id);

