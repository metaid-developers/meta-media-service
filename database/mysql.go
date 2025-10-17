package database

import (
	"fmt"
	"log"
	"time"

	"meta-media-service/conf"
	"meta-media-service/model"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB initialize database connection
func InitDB() error {
	var err error

	// Build DSN
	dsn := conf.Cfg.Database.Dsn
	if dsn == "" {
		return fmt.Errorf("database dsn is empty")
	}

	// Connect database
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	// Get underlying sql.DB
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}

	// Set connection pool
	sqlDB.SetMaxOpenConns(conf.Cfg.Database.MaxOpenConns)
	sqlDB.SetMaxIdleConns(conf.Cfg.Database.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Auto migration
	// if err := autoMigrate(); err != nil {
	// 	return fmt.Errorf("failed to auto migrate: %w", err)
	// }

	log.Println("Database connected successfully")
	return nil
}

// autoMigrate auto migrate database table structure
func autoMigrate() error {
	return DB.AutoMigrate(
		&model.File{},
		&model.FileChunk{},
		&model.Assistant{},
	)
}

// CloseDB close database connection
func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
