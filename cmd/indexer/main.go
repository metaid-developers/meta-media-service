package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"meta-media-service/conf"
	"meta-media-service/controller"
	"meta-media-service/database"
	"meta-media-service/service/indexer_service"
	"meta-media-service/storage"
)

var ENV string

func init() {
	flag.StringVar(&ENV, "env", "mainnet", "Environment: loc/mainnet/testnet")
}

// @title           Meta Media Indexer API
// @version         1.0
// @description     Meta Media Indexer Service API, provides file query and download functionality
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:7281
// @BasePath  /api/v1

// @schemes http https

func main() {
	// Initialize all components
	indexerService, srv, cleanup := initAll()
	defer cleanup()

	// Start indexer service (in goroutine)
	go indexerService.Start()
	log.Println("Indexer service started successfully")

	// Start HTTP API service (in goroutine)
	go startServer(srv)
	log.Println("Indexer API service started successfully")

	// Wait for shutdown signal
	waitForShutdown()

	log.Println("Shutting down indexer service...")

	// Gracefully shutdown HTTP service
	shutdownServer(srv)

	log.Println("Server exited")
}

// initEnv initialize environment
func initEnv() {
	if ENV == "loc" {
		conf.SystemEnvironmentEnum = conf.LocalEnvironmentEnum
	} else if ENV == "mainnet" {
		conf.SystemEnvironmentEnum = conf.MainnetEnvironmentEnum
	} else if ENV == "testnet" {
		conf.SystemEnvironmentEnum = conf.TestnetEnvironmentEnum
	} else if ENV == "example" {
		conf.SystemEnvironmentEnum = conf.ExampleEnvironmentEnum
	}
	fmt.Printf("Environment: %s\n", ENV)
}

// initAll initialize all components
func initAll() (*indexer_service.IndexerService, *http.Server, func()) {
	// Parse command line parameters
	flag.Parse()

	// Set environment
	initEnv()

	// Initialize configuration
	if err := conf.InitConfig(); err != nil {
		log.Fatalf("Failed to initialize config: %v", err)
	}
	log.Printf("Configuration loaded: env=%s, net=%s, port=%s", ENV, conf.Cfg.Net, conf.Cfg.IndexerPort)

	// Initialize database
	if err := database.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize storage
	stor, err := storage.NewStorage()
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	log.Printf("Storage initialized: type=%s", conf.Cfg.Storage.Type)

	// Create indexer service
	indexerService, err := indexer_service.NewIndexerService(stor)
	if err != nil {
		log.Fatalf("Failed to create indexer service: %v", err)
	}

	// Setup indexer service router
	router := controller.SetupIndexerRouter(stor)

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + conf.Cfg.IndexerPort,
		Handler: router,
	}

	// Return service instance and cleanup function
	cleanup := func() {
		database.CloseDB()
	}

	return indexerService, srv, cleanup
}

// startServer start HTTP server
func startServer(srv *http.Server) {
	log.Printf("Indexer API service starting on port %s...", conf.Cfg.IndexerPort)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// waitForShutdown wait for shutdown signal
func waitForShutdown() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan
}

// shutdownServer gracefully shutdown server
func shutdownServer(srv *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}
}
