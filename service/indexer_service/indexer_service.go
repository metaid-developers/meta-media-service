package indexer_service

import (
	"log"

	"meta-media-service/conf"
	"meta-media-service/indexer"
	"meta-media-service/model/dao"
	"meta-media-service/storage"

	wire2 "github.com/bitcoinsv/bsvd/wire"
)

// IndexerService indexer service
type IndexerService struct {
	scanner *indexer.BlockScanner
	fileDAO *dao.FileDAO
	storage storage.Storage
}

// NewIndexerService create indexer service instance
func NewIndexerService(storage storage.Storage) (*IndexerService, error) {
	// Get start height
	startHeight := conf.Cfg.Indexer.StartHeight
	if startHeight == 0 {
		// Get max block height from database
		fileDAO := dao.NewFileDAO()
		maxHeight, err := fileDAO.GetMaxBlockHeight()
		if err != nil {
			log.Printf("Failed to get max block height: %v", err)
		} else {
			startHeight = maxHeight + 1
		}
	}

	// Create block scanner
	scanner := indexer.NewBlockScanner(
		conf.Cfg.Chain.RpcUrl,
		conf.Cfg.Chain.RpcUser,
		conf.Cfg.Chain.RpcPass,
		startHeight,
		conf.Cfg.Indexer.ScanInterval,
	)

	return &IndexerService{
		scanner: scanner,
		fileDAO: dao.NewFileDAO(),
		storage: storage,
	}, nil
}

// Start start indexer service
func (s *IndexerService) Start() {
	log.Println("Indexer service starting...")

	// Start block scanning
	s.scanner.Start(s.handleTransaction)
}

// handleTransaction handle transaction
func (s *IndexerService) handleTransaction(tx *wire2.MsgTx, metaData *indexer.MetaIDData, height int64) error {
	txID := tx.TxHash().String()

	log.Printf("Found MetaID transaction: %s at height %d", txID, height)

	return nil
}
