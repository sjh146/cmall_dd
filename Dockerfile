# Backend Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod files
COPY server/go.mod server/go.sum ./
WORKDIR /app

# Download dependencies
RUN go mod download

# Copy source code
COPY server/ .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -o cmall_dd .

# Production image
FROM alpine:3.19

WORKDIR /app

# Install certificates for HTTPS
RUN apk add --no-cache ca-certificates

# Copy the binary from builder
COPY --from=builder /app/cmall_dd .

# Copy .env file
COPY server/.env .

# Expose port
EXPOSE 8081

# Run the application
CMD ["./cmall_dd"]