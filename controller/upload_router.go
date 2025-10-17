package controller

import (
	"meta-media-service/conf"
	"meta-media-service/controller/handler"
	"meta-media-service/controller/respond"
	uploaderDocs "meta-media-service/docs/uploader"
	"meta-media-service/service/upload_service"
	"meta-media-service/storage"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// SetupUploadRouter setup upload service router
func SetupUploadRouter(stor storage.Storage) *gin.Engine {
	// Set Swagger host from config
	uploaderDocs.SwaggerInfouploader.Host = conf.Cfg.Uploader.SwaggerBaseUrl

	// Create Gin engine
	r := gin.Default()

	// Add timing middleware
	r.Use(respond.TimingMiddleware())

	// Create upload service instance
	uploadService := upload_service.NewUploadService(stor)

	// Create handler instance
	uploadHandler := handler.NewUploadHandler(uploadService)

	// Static file service (upload page)
	// Map web directory directly to root path for direct access to app.js
	r.StaticFile("/", "./web/index.html")
	r.StaticFile("/app.js", "./web/app.js")
	r.Static("/static", "./web")

	// API v1 route group
	v1 := r.Group("/api/v1")
	{
		// File upload
		v1.POST("/files/pre-upload", uploadHandler.PreUpload)
		v1.POST("/files/commit-upload", uploadHandler.CommitUpload)

		// Configuration
		v1.GET("/config", uploadHandler.GetConfig)
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "uploader",
		})
	})

	// Ignore Chrome DevTools requests
	r.GET("/.well-known/*any", func(c *gin.Context) {
		c.Status(204) // No Content
	})

	// Swagger documentation
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler,
		ginSwagger.InstanceName("uploader")))

	return r
}
