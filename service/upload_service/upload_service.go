package upload_service

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"strings"

	chaincfg2 "github.com/bitcoinsv/bsvd/chaincfg"
	"gorm.io/gorm"

	"meta-media-service/common"
	"meta-media-service/conf"
	"meta-media-service/database"
	"meta-media-service/indexer"
	"meta-media-service/model"
	"meta-media-service/model/dao"
	"meta-media-service/node"
	"meta-media-service/storage"
)

// UploadService upload service
type UploadService struct {
	fileDAO *dao.FileDAO
	storage storage.Storage
}

// NewUploadService create upload service instance
func NewUploadService(storage storage.Storage) *UploadService {
	return &UploadService{
		fileDAO: dao.NewFileDAO(),
		storage: storage,
	}
}

// UploadRequest upload request
type UploadRequest struct {
	MetaId        string                // MetaID
	Address       string                // Address
	FileName      string                // File name
	Content       []byte                // File content
	Path          string                // MetaID path
	Operation     string                // create/update
	ContentType   string                // Content type
	ChangeAddress string                // Change address
	Inputs        []*common.TxInputUtxo // Input UTXO
	Outputs       []*common.TxOutput    // Outputs
	OtherOutputs  []*common.TxOutput    // Other outputs
	FeeRate       int64                 // Fee rate
}

// PreUploadResponse pre-upload response
type PreUploadResponse struct {
	FileId    string `json:"fileId"`    // File ID (unique identifier)
	FileMd5   string `json:"fileMd5"`   // File md5
	FileHash  string `json:"fileHash"`  // File hash
	TxId      string `json:"txId"`      // Transaction ID
	PinId     string `json:"pinId"`     // Pin ID
	PreTxRaw  string `json:"preTxRaw"`  // Pre-transaction raw data
	Status    string `json:"status"`    // Status
	Message   string `json:"message"`   // Message (e.g., exists, success, etc.)
	CalTxFee  int64  `json:"calTxFee"`  // Calculated transaction fee
	CalTxSize int64  `json:"calTxSize"` // Calculated transaction size
}

// UploadResponse upload response
type UploadResponse struct {
	FileId  string `json:"fileId"`  // File ID
	Status  string `json:"status"`  // Status
	TxId    string `json:"txId"`    // Transaction ID
	PinId   string `json:"pinId"`   // Pin ID
	Message string `json:"message"` // Message
}

// PreUpload pre-upload: build transaction and save file metadata
func (s *UploadService) PreUpload(req *UploadRequest) (*PreUploadResponse, error) {
	// Parameter validation
	if len(req.Content) == 0 {
		return nil, fmt.Errorf("file content is empty")
	}
	if req.Path == "" {
		return nil, fmt.Errorf("file path is required")
	}

	// Set default values
	if req.Operation == "" {
		req.Operation = "create"
	}
	if req.ContentType == "" {
		req.ContentType = "application/octet-stream"
	}
	if req.FeeRate == 0 {
		req.FeeRate = conf.Cfg.Uploader.FeeRate
	}

	// Get network parameters
	var netParam *chaincfg2.Params
	if conf.Cfg.Net == "mainnet" {
		netParam = &chaincfg2.MainNetParams
	} else {
		netParam = &chaincfg2.TestNet3Params
	}

	// Build transaction
	tx, err := common.BuildMvcCommonMetaIdTxForUnkwonInput(
		netParam,
		req.Inputs,
		req.Outputs,
		req.OtherOutputs,
		req.Operation,
		req.Path,
		req.Content,
		req.ContentType,
		req.ChangeAddress,
		req.FeeRate,
		true, // No signature needed
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build transaction: %w", err)
	}

	txSize := tx.SerializeSize()
	txFee := int64(txSize) * req.FeeRate

	// Get transaction ID and raw transaction
	// txID := tx.Txhash().String()
	preTxRaw, err := indexer.TxToHex(tx)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize transaction: %w", err)
	}

	// Calculate file hash
	sha256hash := sha256.Sum256(req.Content)
	md5hash := md5.Sum(req.Content)
	filehashStr := hex.EncodeToString(sha256hash[:])
	md5hashStr := hex.EncodeToString(md5hash[:])

	// Generate FileId (ensure uniqueness)
	fileId := req.MetaId + "_" + filehashStr

	// Check if FileId already exists
	existingFile, err := s.fileDAO.GetByFileID(fileId)
	if err == nil && existingFile != nil {
		// File already exists, return different info based on status
		if existingFile.Status == model.StatusSuccess {
			// File already successfully uploaded to chain
			log.Printf("File already exists and uploaded successfully: FileId=%s", fileId)
			return &PreUploadResponse{
				TxId:     existingFile.TxID,
				PinId:    existingFile.PinId,
				FileId:   existingFile.FileId,
				FileMd5:  existingFile.FileMd5,
				FileHash: existingFile.FileHash,
				PreTxRaw: preTxRaw,
				Status:   string(existingFile.Status),
				Message:  "file already exists and uploaded",
			}, nil
		} else if existingFile.Status == model.StatusPending {
			// File is being processed, return existing PreTxRaw
			log.Printf("File already exists in pending status: FileId=%s", fileId)
			return &PreUploadResponse{
				FileId:   existingFile.FileId,
				FileMd5:  existingFile.FileMd5,
				FileHash: existingFile.FileHash,
				PreTxRaw: preTxRaw,
				Status:   string(existingFile.Status),
				Message:  "file already in pending, please commit",
			}, nil
		}
		// If status is failed, allow re-upload
		log.Printf("File exists but failed, allow re-upload: FileId=%s", fileId)
	}

	// Save file metadata (status pending)
	file := &model.File{
		FileId:          fileId,
		FileName:        req.FileName,
		FileType:        strings.ReplaceAll(req.ContentType, ";binary", ""),
		MetaId:          req.MetaId,
		Address:         req.Address,
		Path:            req.Path,
		ContentType:     req.ContentType,
		FileSize:        int64(len(req.Content)),
		FileHash:        filehashStr,
		FileMd5:         md5hashStr,
		FileContentType: strings.ReplaceAll(req.ContentType, ";binary", ""),
		ChunkType:       model.ChunkTypeSingle,
		Operation:       req.Operation,
		// PreTxRaw:        preTxRaw,
		Status: model.StatusPending, // Set status to pending
	}

	if err := s.fileDAO.Create(file); err != nil {
		return nil, fmt.Errorf("failed to save file metadata: %w", err)
	}

	log.Printf("File metadata saved successfully: FileId=%s, status=pending", file.FileId)

	return &PreUploadResponse{
		FileId:    file.FileId,
		FileMd5:   md5hashStr,
		FileHash:  filehashStr,
		PreTxRaw:  preTxRaw,
		Status:    string(file.Status),
		TxId:      file.TxID,
		PinId:     file.PinId,
		CalTxFee:  txFee,
		CalTxSize: int64(txSize),
		Message:   "success",
	}, nil
}

// CommitUpload commit upload: broadcast transaction and update file status
// Use database transaction to ensure data consistency
func (s *UploadService) CommitUpload(fileId string, signedRawTx string) (*UploadResponse, error) {

	var (
		txId   string
		status string
	)
	// Use database transaction
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Query file record
		var file model.File
		if err := tx.Where("file_id = ?", fileId).First(&file).Error; err != nil {
			return fmt.Errorf("failed to find file record: %w", err)
		}

		// Check file status
		if file.Status == model.StatusSuccess {
			log.Printf("File already committed: fileId=%s", fileId)
			return fmt.Errorf("file already committed: fileId=%s", fileId)
		}
		txhash := common.GetMvcTxhashFromRaw(signedRawTx)

		// 2. Update file record
		// file.TxRaw = signedRawTx
		file.TxID = txhash
		file.PinId = fmt.Sprintf("%si0", txhash)
		file.Status = model.StatusSuccess
		if err := tx.Save(&file).Error; err != nil {
			return fmt.Errorf("failed to update file record: %w", err)
		}
		status = string(file.Status)
		txId = file.TxID

		// 3. Broadcast transaction to blockchain network
		chain := conf.Cfg.Net // Use network type from configuration
		broadcastTxID, err := node.BroadcastTx(chain, signedRawTx)
		if err != nil {
			// Broadcast failed, update status to failed
			file.Status = model.StatusFailed
			if updateErr := tx.Save(&file).Error; updateErr != nil {
				return fmt.Errorf("failed to update file status to failed: %w", updateErr)
			}
			return fmt.Errorf("failed to broadcast transaction: %w", err)
		}

		log.Printf("Transaction broadcasted successfully: fileId=%s, broadcastTxID=%s", fileId, broadcastTxID)

		log.Printf("File status updated to success: fileId=%s", fileId)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &UploadResponse{
		FileId:  fileId,
		Status:  status,
		TxId:    txId,
		PinId:   fmt.Sprintf("%si0", txId),
		Message: "success",
	}, nil
}
