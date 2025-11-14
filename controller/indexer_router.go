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
func SetupIndexerRouter(stor storage.Storage, indexerService *indexer_service.IndexerService) *gin.Engine {
	// Set Swagger host from config
	indexerDocs.SwaggerInfoindexer.Host = conf.Cfg.Indexer.SwaggerBaseUrl

	// Create Gin engine
	r := gin.Default()

	// Add timing middleware
	r.Use(respond.TimingMiddleware())

	// Create indexer file service instance
	indexerFileService := indexer_service.NewIndexerFileService(stor)

	// Create sync status service instance
	syncStatusService := indexer_service.NewSyncStatusService()
	// Set scanner for getting latest block height
	if indexerService != nil {
		syncStatusService.SetBlockScanner(indexerService.GetScanner())
	}

	// Create handler
	indexerQueryHandler := handler.NewIndexerQueryHandler(indexerFileService, syncStatusService)

	// API v1 route group
	v1 := r.Group("/api/v1")
	{
		// Indexer file query routes (using cursor pagination)
		files := v1.Group("/files")
		{
			// Get file list (cursor pagination)
			files.GET("", indexerQueryHandler.ListFiles)

			// Get file by PIN ID
			files.GET("/:pinId", indexerQueryHandler.GetByPinID)

			// Get file content by PIN ID
			files.GET("/content/:pinId", indexerQueryHandler.GetFileContent)

			// Get files by creator address
			files.GET("/creator/:address", indexerQueryHandler.GetByCreatorAddress)

			// Get files by creator MetaID
			files.GET("/metaid/:metaId", indexerQueryHandler.GetByCreatorMetaID)
		}

		// Indexer avatar query routes
		avatars := v1.Group("/avatars")
		{
			// Get avatar list (cursor pagination)
			avatars.GET("", indexerQueryHandler.ListAvatars)

			// Get avatar content by PIN ID
			avatars.GET("/content/:pinId", indexerQueryHandler.GetAvatarContent)

			// Get latest avatar by MetaID
			avatars.GET("/metaid/:metaId", indexerQueryHandler.GetLatestAvatarByMetaID)

			// Get latest avatar by address
			avatars.GET("/address/:address", indexerQueryHandler.GetLatestAvatarByAddress)
		}

		// Sync status route
		v1.GET("/status", indexerQueryHandler.GetSyncStatus)

		// Statistics route
		v1.GET("/stats", indexerQueryHandler.GetStats)
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

	// Static files and web pages
	r.Static("/static", "./web/static")
	r.StaticFile("/", "./web/indexer.html")
	r.StaticFile("/indexer.html", "./web/indexer.html")
	r.StaticFile("/indexer.js", "./web/indexer.js")

	return r
}
