package indexer

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"

	wire2 "github.com/bitcoinsv/bsvd/wire"
	"github.com/btcsuite/btcd/txscript"
)

// MetaIDData MetaID protocol data
type MetaIDData struct {
	Operation   string // create/update
	Path        string // File path
	Encryption  string // Encryption method
	Version     string // Version
	ContentType string // Content type
	Content     []byte // File content
}

// ParseMetaIDTx parse MetaID transaction
func ParseMetaIDTx(tx *wire2.MsgTx) (*MetaIDData, error) {
	// Traverse all outputs, find OP_RETURN containing metaid identifier
	for _, txOut := range tx.TxOut {
		if isMetaIDScript(txOut.PkScript) {
			data, err := parseMetaIDScript(txOut.PkScript)
			if err != nil {
				continue
			}
			return data, nil
		}
	}

	return nil, errors.New("no metaid data found in transaction")
}

// isMetaIDScript check if script is MetaID script
func isMetaIDScript(script []byte) bool {
	// Parse script
	tokenizer := txscript.MakeScriptTokenizer(0, script)

	// Skip OP_0
	if !tokenizer.Next() {
		return false
	}

	// Check OP_RETURN
	if !tokenizer.Next() || tokenizer.Opcode() != txscript.OP_RETURN {
		return false
	}

	// Check "metaid" identifier
	if !tokenizer.Next() {
		return false
	}

	data := tokenizer.Data()
	return bytes.Equal(data, []byte("metaid"))
}

// parseMetaIDScript parse MetaID script
func parseMetaIDScript(script []byte) (*MetaIDData, error) {
	tokenizer := txscript.MakeScriptTokenizer(0, script)

	// Skip OP_0
	if !tokenizer.Next() {
		return nil, errors.New("invalid script: missing OP_0")
	}

	// Skip OP_RETURN
	if !tokenizer.Next() || tokenizer.Opcode() != txscript.OP_RETURN {
		return nil, errors.New("invalid script: missing OP_RETURN")
	}

	// Read all data segments
	var dataChunks [][]byte
	for tokenizer.Next() {
		if tokenizer.Opcode() > txscript.OP_0 && tokenizer.Opcode() <= txscript.OP_PUSHDATA4 {
			dataChunks = append(dataChunks, tokenizer.Data())
		}
	}

	if len(dataChunks) < 6 {
		return nil, fmt.Errorf("invalid metaid script: expected at least 6 chunks, got %d", len(dataChunks))
	}

	// Parse data
	data := &MetaIDData{
		Operation:   string(dataChunks[1]), // operation
		Path:        string(dataChunks[2]), // path
		Encryption:  string(dataChunks[3]), // encryption
		Version:     string(dataChunks[4]), // version
		ContentType: string(dataChunks[5]), // content-type
	}

	// Concat file content (may be scattered in multiple chunks)
	if len(dataChunks) > 6 {
		var content bytes.Buffer
		for i := 6; i < len(dataChunks); i++ {
			content.Write(dataChunks[i])
		}
		data.Content = content.Bytes()
	}

	return data, nil
}

// TxToHex convert transaction to hexadecimal string
func TxToHex(tx *wire2.MsgTx) (string, error) {
	var buf bytes.Buffer
	if err := tx.Serialize(&buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf.Bytes()), nil
}
