package handler

import (
	"strconv"

	"meta-media-service/controller/respond"
	"meta-media-service/service/indexer_service"

	"github.com/gin-gonic/gin"
)

// QueryHandler query handler
type QueryHandler struct {
	fileService *indexer_service.FileService
}

// NewQueryHandler create query handler instance
func NewQueryHandler(fileService *indexer_service.FileService) *QueryHandler {
	return &QueryHandler{
		fileService: fileService,
	}
}

// List query file list
// @Summary      Query file list
// @Description  Query file list with pagination
// @Tags         File Query
// @Accept       json
// @Produce      json
// @Param        page       query    int  false  "Page number"       default(1)
// @Param        page_size  query    int  false  "Page size"   default(20)
// @Success      200  {object}  respond.Response{data=object{files=[]model.File,total=int,page=int,page_size=int}}
// @Failure      500  {object}  respond.Response
// @Router       /files [get]
func (h *QueryHandler) List(c *gin.Context) {
	// Get pagination parameters
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "20")

	page, _ := strconv.Atoi(pageStr)
	pageSize, _ := strconv.Atoi(pageSizeStr)

	// Query file list
	files, total, err := h.fileService.ListFiles(page, pageSize)
	if err != nil {
		respond.ServerError(c, err.Error())
		return
	}

	respond.Success(c, gin.H{
		"files":     files,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetByTxID get file information by transaction ID
// @Summary      Get file by transaction ID
// @Description  Query file details by transaction ID
// @Tags         File Query
// @Accept       json
// @Produce      json
// @Param        txid  path      string  true  "Transaction ID"
// @Success      200   {object}  respond.Response{data=model.File}
// @Failure      404   {object}  respond.Response
// @Router       /files/{txid} [get]
func (h *QueryHandler) GetByTxID(c *gin.Context) {
	txID := c.Param("txid")
	if txID == "" {
		respond.InvalidParam(c, "txid is required")
		return
	}

	file, err := h.fileService.GetFileByTxID(txID)
	if err != nil {
		respond.NotFound(c, err.Error())
		return
	}

	respond.Success(c, file)
}

// GetByPath get file information by path
// @Summary      Get file by path
// @Description  Query file details by file path
// @Tags         File Query
// @Accept       json
// @Produce      json
// @Param        path  path      string  true  "File path"
// @Success      200   {object}  respond.Response{data=model.File}
// @Failure      404   {object}  respond.Response
// @Router       /files/path/{path} [get]
func (h *QueryHandler) GetByPath(c *gin.Context) {
	path := c.Param("path")
	if path == "" {
		respond.InvalidParam(c, "path is required")
		return
	}

	// Remove leading slash from path
	if len(path) > 0 && path[0] == '/' {
		path = path[1:]
	}

	file, err := h.fileService.GetFileByPath(path)
	if err != nil {
		respond.NotFound(c, err.Error())
		return
	}

	respond.Success(c, file)
}
