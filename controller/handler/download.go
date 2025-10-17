package handler

import (
	"net/http"

	"meta-media-service/controller/respond"
	"meta-media-service/service/indexer_service"

	"github.com/gin-gonic/gin"
)

// DownloadHandler download handler
type DownloadHandler struct {
	fileService *indexer_service.FileService
}

// NewDownloadHandler create download handler instance
func NewDownloadHandler(fileService *indexer_service.FileService) *DownloadHandler {
	return &DownloadHandler{
		fileService: fileService,
	}
}

// Download download file content
// @Summary      Download file content
// @Description  Download file content by transaction ID
// @Tags         File Download
// @Accept       json
// @Produce      octet-stream
// @Param        txid  path      string  true  "Transaction ID"
// @Success      200   {file}    binary
// @Failure      404   {object}  respond.Response
// @Failure      500   {object}  respond.Response
// @Router       /files/{txid}/content [get]
func (h *DownloadHandler) Download(c *gin.Context) {
	txID := c.Param("txid")
	if txID == "" {
		respond.InvalidParam(c, "txid is required")
		return
	}

	// Get file information
	file, err := h.fileService.GetFileByTxID(txID)
	if err != nil {
		respond.NotFound(c, err.Error())
		return
	}

	// Get file content
	content, err := h.fileService.GetFileContent(txID)
	if err != nil {
		respond.ServerError(c, "failed to get file content")
		return
	}

	// Set response headers
	c.Header("Content-Type", file.ContentType)
	c.Header("Content-Disposition", "attachment; filename="+file.Path)

	// Return file content
	c.Data(http.StatusOK, file.ContentType, content)
}
