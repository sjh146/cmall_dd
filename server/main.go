package main

import (
	"log"
	"os"
	"strings"

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
	config.AllowOrigins = splitEnv(os.Getenv("CORS_ORIGINS"), []string{"http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"})
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
			// 지갑 인증 (M3 — ZK Smart Wallet 흐름의 Web2 진입점)
			auth.POST("/nonce", handlers.WalletNonce(db))
			auth.POST("/verify", handlers.WalletVerify(db))
		}

		// Products routes (public)
		api.GET("/products", handlers.GetProducts(db))
		api.GET("/products/search", handlers.SearchProducts(db))
		api.GET("/products/:id", handlers.OptionalAuthMiddleware(), handlers.GetProduct(db))

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
		api.DELETE("/cart/:id", handlers.OptionalAuthMiddleware(), handlers.RemoveFromCart(db))
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
			protected.GET("/diaries", handlers.GetDiaries(db))
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

			// ── 결제 플랫폼 (M3 — 지갑/USDC 결제 + 분석) ──
			protected.POST("/wallet/connect", handlers.WalletConnect(db))
			// M2-1: World ID 인간 증명 (설계: M2-zk-auth-design.md §3.1)
			protected.POST("/wallet/humanity/nonce", handlers.HumanityNonce(db))
			protected.POST("/wallet/humanity/verify", handlers.HumanityVerify(db))
			protected.POST("/payments/create", handlers.CreatePayment(db))
			protected.GET("/payments/:referenceId", handlers.GetPayment(db))
			protected.POST("/analysis", handlers.CreateAnalysis(db))
			protected.GET("/analysis/:requestId", handlers.GetAnalysis(db))
		}

		// AI 에이전트 상품 목록 (public)
		api.GET("/agents", handlers.GetAgents(db))
		// M2-1: World ID 공개 설정 (프론트 위젯 주입용)
		api.GET("/config/worldid", handlers.WorldIDPublicConfig(db))

		// OpenClaw browser automation routes (인증 필수 — SSRF/CWE-918 대응)
		openclawBaseURL := os.Getenv("OPENCLAW_BASE_URL")
		openclaw := openclawHandler.NewHandler(db, openclawBaseURL)
		openclawGroup := api.Group("/openclaw")
		openclawGroup.Use(handlers.AuthMiddleware())
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

func splitEnv(val string, defaults []string) []string {
	if strings.TrimSpace(val) == "" {
		return defaults
	}
	out := make([]string, 0, 8)
	for _, p := range strings.Split(val, ",") {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	if len(out) == 0 {
		return defaults
	}
	return out
}
// ci e2e: jenkins webhook verification
// ci e2e: webhook re-registered to 8080 tunnel (jenkins)
