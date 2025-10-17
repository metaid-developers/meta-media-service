package controller

import (
	"meta-media-service/conf"
	"meta-media-service/controller/handler"
	"meta-media-service/controller/respond"
	indexerDocs "meta-media-service/docs/indexer"
	"meta-media-service/service/indexer_service"
	"meta-media-service/storage"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// SetupIndexerRouter setup indexer service router
func SetupIndexerRouter(stor storage.Storage) *gin.Engine {
	// Set Swagger host from config
	indexerDocs.SwaggerInfoindexer.Host = conf.Cfg.Indexer.SwaggerBaseUrl

	// Create Gin engine
	r := gin.Default()

	// Add timing middleware
	r.Use(respond.TimingMiddleware())

	// Create file service instance
	fileService := indexer_service.NewFileService(stor)

	// Create handler instances
	queryHandler := handler.NewQueryHandler(fileService)
	downloadHandler := handler.NewDownloadHandler(fileService)

	// API v1 route group
	v1 := r.Group("/api/v1")
	{
		// File query
		v1.GET("/files", queryHandler.List)
		v1.GET("/files/:txid", queryHandler.GetByTxID)
		v1.GET("/files/path/*path", queryHandler.GetByPath)

		// File download
		v1.GET("/files/:txid/content", downloadHandler.Download)
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "indexer",
		})
	})

	// Swagger documentation
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler,
		ginSwagger.InstanceName("indexer")))

	return r
}
