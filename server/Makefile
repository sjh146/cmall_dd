.PHONY: run build test clean migrate seed

# Run the server
run:
	go run main.go

# Build the binary
build:
	go build -o cmall_dd main.go

# Run tests
test:
	go test ./...

# Clean build artifacts
clean:
	rm -f cmall_dd

# Initialize database (requires psql)
migrate:
	psql -h localhost -U postgres -d postgres -f scripts/init_db.sql

# Seed sample data (requires psql)
seed:
	psql -h localhost -U postgres -d postgres -f scripts/seed_data.sql

# Install dependencies
deps:
	go mod download
	go mod tidy

# Run with hot reload (requires air)
dev:
	air

