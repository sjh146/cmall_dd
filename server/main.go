package main

import (
	"log"
	"os"

	"cmall_dd/internal/database"
	"cmall_dd/internal/handlers"
	openclawHandler "cmall_dd/internal/openclaw"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
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
	config.AllowOrigins = []string{"http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	config.AllowCredentials = true
	r.Use(cors.New(config))

	// API routes
	api := r.Group("/api/v1")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.Register(db))
			auth.POST("/login", handlers.Login(db))
		}

		// Products routes (public)
		api.GET("/products", handlers.GetProducts(db))
		api.GET("/products/search", handlers.SearchProducts(db))
		api.GET("/products/:id", handlers.GetProduct(db))

		// Diary routes (public GET, protected POST/DELETE)
		api.GET("/diaries", handlers.GetDiaries(db))

		// Lecture routes (public GET, protected CRUD)
		api.GET("/lectures", handlers.GetLectures(db))
		api.GET("/lectures/:id", handlers.GetLecture(db))

		// Notice routes (public GET, protected CRUD)
		api.GET("/notices", handlers.GetNotices(db))
		api.GET("/notices/:id", handlers.GetNotice(db))

		// Cart routes (optional auth - uses session if not logged in)
		api.GET("/cart", handlers.OptionalAuthMiddleware(), handlers.GetCart(db))
		api.POST("/cart", handlers.OptionalAuthMiddleware(), handlers.AddToCart(db))
		api.PUT("/cart/:id", handlers.OptionalAuthMiddleware(), handlers.UpdateCartItem(db))
		api.DELETE("/cart/:id", handlers.RemoveFromCart(db))
		api.POST("/cart/merge", handlers.OptionalAuthMiddleware(), handlers.MergeCart(db))

		// Protected routes (require authentication)
		protected := api.Group("")
		protected.Use(handlers.AuthMiddleware())
		{
			// User profile
			protected.GET("/user", handlers.GetCurrentUser(db))
			protected.PUT("/user", handlers.UpdateUser(db))

			// Seller products (CRUD)
			protected.POST("/products", handlers.CreateProduct(db))
			protected.PUT("/products/:id", handlers.UpdateProduct(db))
			protected.DELETE("/products/:id", handlers.DeleteProduct(db))
			protected.GET("/my-products", handlers.GetMyProducts(db))

			// Diary (protected)
			protected.POST("/diaries", handlers.CreateDiary(db))
			protected.PUT("/diaries/:id", handlers.UpdateDiary(db))
			protected.DELETE("/diaries", handlers.DeleteDiary(db))
			protected.POST("/diary-comments", handlers.CreateComment(db))
			protected.DELETE("/diary-comments", handlers.DeleteComment(db))

			// Admin: Lectures (CRUD)
			protected.GET("/admin/lectures", handlers.GetAllLectures(db))
			protected.POST("/lectures", handlers.CreateLecture(db))
			protected.PUT("/lectures/:id", handlers.UpdateLecture(db))
			protected.DELETE("/lectures/:id", handlers.DeleteLecture(db))

			// Admin: Notices (CRUD)
			protected.GET("/admin/notices", handlers.GetAllNotices(db))
			protected.POST("/notices", handlers.CreateNotice(db))
			protected.PUT("/notices/:id", handlers.UpdateNotice(db))
			protected.DELETE("/notices/:id", handlers.DeleteNotice(db))

			// Admin: Set user as admin (for testing)
			protected.POST("/admin/set-admin", handlers.SetUserAsAdmin(db))
		}

		// OpenClaw browser automation routes
		openclawBaseURL := os.Getenv("OPENCLAW_BASE_URL")
		openclaw := openclawHandler.NewHandler(db, openclawBaseURL)
		openclawGroup := api.Group("/openclaw")
		{
			openclawGroup.GET("/health", openclaw.HealthCheck)
			openclawGroup.POST("/click", openclaw.ClickElement)
			openclawGroup.POST("/snapshot", openclaw.TakeSnapshot)
		}
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
