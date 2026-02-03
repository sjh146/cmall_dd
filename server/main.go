package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"cmall_dd/internal/database"
	"cmall_dd/internal/handlers"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	db, err := database.InitDB()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Create tables if they don't exist
	if err := database.CreateTables(db); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	// Setup router
	r := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000", "http://localhost:5173"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	config.AllowCredentials = true
	r.Use(cors.New(config))

	// API routes
	api := r.Group("/api/v1")
	{
		api.GET("/products", handlers.GetProducts(db))
		api.GET("/products/:id", handlers.GetProduct(db))
		api.POST("/products", handlers.CreateProduct(db))
		api.PUT("/products/:id", handlers.UpdateProduct(db))
		api.DELETE("/products/:id", handlers.DeleteProduct(db))
		
		api.GET("/cart", handlers.GetCart(db))
		api.POST("/cart", handlers.AddToCart(db))
		api.PUT("/cart/:id", handlers.UpdateCartItem(db))
		api.DELETE("/cart/:id", handlers.RemoveFromCart(db))
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

