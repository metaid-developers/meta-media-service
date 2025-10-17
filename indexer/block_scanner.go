package indexer

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"meta-media-service/tool"

	wire2 "github.com/bitcoinsv/bsvd/wire"
)

// BlockScanner block scanner
type BlockScanner struct {
	rpcURL      string
	rpcUser     string
	rpcPassword string
	startHeight int64
	interval    time.Duration
}

// NewBlockScanner create block scanner
func NewBlockScanner(rpcURL, rpcUser, rpcPassword string, startHeight int64, interval int) *BlockScanner {
	return &BlockScanner{
		rpcURL:      rpcURL,
		rpcUser:     rpcUser,
		rpcPassword: rpcPassword,
		startHeight: startHeight,
		interval:    time.Duration(interval) * time.Second,
	}
}

// RPCRequest RPC request structure
type RPCRequest struct {
	Jsonrpc string        `json:"jsonrpc"`
	ID      string        `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

// RPCResponse RPC response structure
type RPCResponse struct {
	Result interface{} `json:"result"`
	Error  *RPCError   `json:"error"`
	ID     string      `json:"id"`
}

// RPCError RPC error structure
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// GetBlockCount get current block height
func (s *BlockScanner) GetBlockCount() (int64, error) {
	request := RPCRequest{
		Jsonrpc: "1.0",
		ID:      "getblockcount",
		Method:  "getblockcount",
		Params:  []interface{}{},
	}

	response, err := s.rpcCall(request)
	if err != nil {
		return 0, err
	}

	if response.Error != nil {
		return 0, fmt.Errorf("rpc error: %s", response.Error.Message)
	}

	height, ok := response.Result.(float64)
	if !ok {
		return 0, errors.New("invalid block height response")
	}

	return int64(height), nil
}

// GetBlockHash get block hash
func (s *BlockScanner) GetBlockhash(height int64) (string, error) {
	request := RPCRequest{
		Jsonrpc: "1.0",
		ID:      "getblockhash",
		Method:  "getblockhash",
		Params:  []interface{}{height},
	}

	response, err := s.rpcCall(request)
	if err != nil {
		return "", err
	}

	if response.Error != nil {
		return "", fmt.Errorf("rpc error: %s", response.Error.Message)
	}

	hash, ok := response.Result.(string)
	if !ok {
		return "", errors.New("invalid block hash response")
	}

	return hash, nil
}

// GetBlock get block details (contains transactions)）
func (s *BlockScanner) GetBlock(blockhash string) (map[string]interface{}, error) {
	request := RPCRequest{
		Jsonrpc: "1.0",
		ID:      "getblock",
		Method:  "getblock",
		Params:  []interface{}{blockhash, 2}, // verbosity=2 return complete transaction information
	}

	response, err := s.rpcCall(request)
	if err != nil {
		return nil, err
	}

	if response.Error != nil {
		return nil, fmt.Errorf("rpc error: %s", response.Error.Message)
	}

	block, ok := response.Result.(map[string]interface{})
	if !ok {
		return nil, errors.New("invalid block response")
	}

	return block, nil
}

// GetRawTransaction get raw transaction
func (s *BlockScanner) GetRawTransaction(txID string) (string, error) {
	request := RPCRequest{
		Jsonrpc: "1.0",
		ID:      "getrawtransaction",
		Method:  "getrawtransaction",
		Params:  []interface{}{txID, false},
	}

	response, err := s.rpcCall(request)
	if err != nil {
		return "", err
	}

	if response.Error != nil {
		return "", fmt.Errorf("rpc error: %s", response.Error.Message)
	}

	rawTx, ok := response.Result.(string)
	if !ok {
		return "", errors.New("invalid raw transaction response")
	}

	return rawTx, nil
}

// ParseRawTransaction parse raw transaction
func (s *BlockScanner) ParseRawTransaction(rawTxHex string) (*wire2.MsgTx, error) {
	txBytes, err := hex.DecodeString(rawTxHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex: %w", err)
	}

	var tx wire2.MsgTx
	if err := tx.Deserialize(bytes.NewReader(txBytes)); err != nil {
		return nil, fmt.Errorf("failed to deserialize transaction: %w", err)
	}

	return &tx, nil
}

// ScanBlock scan specified block
func (s *BlockScanner) ScanBlock(height int64, handler func(tx *wire2.MsgTx, metaData *MetaIDData, height int64) error) error {
	// get blockhash
	blockhash, err := s.GetBlockhash(height)
	if err != nil {
		return fmt.Errorf("failed to get block hash: %w", err)
	}

	// get blockData
	block, err := s.GetBlock(blockhash)
	if err != nil {
		return fmt.Errorf("failed to get block: %w", err)
	}

	// get transaction list
	txs, ok := block["tx"].([]interface{})
	if !ok {
		return errors.New("invalid block transactions")
	}

	// traverse transactions
	for _, txData := range txs {
		txMap, ok := txData.(map[string]interface{})
		if !ok {
			continue
		}

		txID, ok := txMap["txid"].(string)
		if !ok {
			continue
		}

		// get raw transaction
		rawTx, err := s.GetRawTransaction(txID)
		if err != nil {
			log.Printf("Failed to get raw transaction %s: %v", txID, err)
			continue
		}

		// parse transaction
		tx, err := s.ParseRawTransaction(rawTx)
		if err != nil {
			log.Printf("Failed to parse transaction %s: %v", txID, err)
			continue
		}

		// parse MetaID data
		metaData, err := ParseMetaIDTx(tx)
		if err != nil {
			// not MetaID transaction, skip
			continue
		}

		// CallProcessFunction
		if err := handler(tx, metaData, height); err != nil {
			log.Printf("Failed to handle transaction %s: %v", txID, err)
		}
	}

	return nil
}

// Start Startscanner
func (s *BlockScanner) Start(handler func(tx *wire2.MsgTx, metaData *MetaIDData, height int64) error) {
	currentHeight := s.startHeight

	log.Printf("Block scanner started from height %d", currentHeight)

	for {
		// get latest block height
		latestHeight, err := s.GetBlockCount()
		if err != nil {
			log.Printf("Failed to get block count: %v", err)
			time.Sleep(s.interval)
			continue
		}

		// if new blocks exist, start scan
		for currentHeight <= latestHeight {
			log.Printf("Scanning block at height %d", currentHeight)

			if err := s.ScanBlock(currentHeight, handler); err != nil {
				log.Printf("Failed to scan block %d: %v", currentHeight, err)
				time.Sleep(s.interval)
				continue
			}

			currentHeight++
		}

		// wait for next scan
		time.Sleep(s.interval)
	}
}

// rpcCall ExecuteRPCCall
func (s *BlockScanner) rpcCall(request RPCRequest) (*RPCResponse, error) {
	// set authentication header
	headers := map[string]string{
		"Authorization": "Basic " + tool.Base64Encode(s.rpcUser+":"+s.rpcPassword),
	}

	// SendRequest
	respStr, err := tool.PostUrl(s.rpcURL, request, headers)
	if err != nil {
		return nil, fmt.Errorf("rpc call failed: %w", err)
	}

	// ParseResponse
	var response RPCResponse
	if err := json.Unmarshal([]byte(respStr), &response); err != nil {
		return nil, fmt.Errorf("failed to parse rpc response: %w", err)
	}

	return &response, nil
}
