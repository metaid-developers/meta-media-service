package indexer_service

import (
	"errors"
	"fmt"

	"meta-media-service/model"
	"meta-media-service/model/dao"
	"meta-media-service/storage"

	"gorm.io/gorm"
)

// FileService file service
type FileService struct {
	fileDAO *dao.FileDAO
	storage storage.Storage
}

// NewFileService create file service instance
func NewFileService(storage storage.Storage) *FileService {
	return &FileService{
		fileDAO: dao.NewFileDAO(),
		storage: storage,
	}
}

// GetFileByTxID get file information by transaction ID
func (s *FileService) GetFileByTxID(txID string) (*model.File, error) {
	file, err := s.fileDAO.GetByTxID(txID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("file not found")
		}
		return nil, fmt.Errorf("failed to get file: %w", err)
	}
	return file, nil
}

// GetFileByPath get file information by path
func (s *FileService) GetFileByPath(path string) (*model.File, error) {
	file, err := s.fileDAO.GetByPath(path)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("file not found")
		}
		return nil, fmt.Errorf("failed to get file: %w", err)
	}
	return file, nil
}

// GetFileContent get file content
func (s *FileService) GetFileContent(txID string) ([]byte, error) {
	// Get file information
	file, err := s.GetFileByTxID(txID)
	if err != nil {
		return nil, err
	}

	// Read file content from storage layer
	content, err := s.storage.Get(file.StoragePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get file content: %w", err)
	}

	return content, nil
}

// ListFiles get file list
func (s *FileService) ListFiles(page, pageSize int) ([]*model.File, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	files, err := s.fileDAO.List(offset, pageSize)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list files: %w", err)
	}

	total, err := s.fileDAO.Count()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count files: %w", err)
	}

	return files, total, nil
}
