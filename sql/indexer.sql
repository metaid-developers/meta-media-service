-- Meta Media Service - Indexer Service Database Initialization Script
-- =============================================
-- File table (tb_file) - read-only view for query
-- =============================================
-- Indexer service mainly indexes data from blockchain to this table
-- table structure same as Uploader, ensures data consistency

CREATE TABLE IF NOT EXISTS `tb_file` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key ID',
    
    -- File identifiers
    `file_id` VARCHAR(255) DEFAULT NULL COMMENT 'File unique ID (metaid_fileHash)',
    `file_name` VARCHAR(255) DEFAULT NULL COMMENT 'File name',
    
    -- File information
    `file_hash` VARCHAR(255) DEFAULT NULL COMMENT 'File hash (SHA256)',
    `file_size` BIGINT DEFAULT NULL COMMENT 'File size (bytes))',
    `file_type` VARCHAR(20) DEFAULT NULL COMMENT 'File type',
    `file_md5` VARCHAR(255) DEFAULT NULL COMMENT 'File MD5',
    `file_content_type` VARCHAR(100) DEFAULT NULL COMMENT 'File content type',
    `chunk_type` VARCHAR(20) DEFAULT NULL COMMENT 'Chunk type (single/multi)',
    
    -- Content
    `content_hex` TEXT COMMENT 'Content hexadecimal',
    
    -- MetaID information
    `meta_id` VARCHAR(255) DEFAULT NULL COMMENT 'MetaID',
    `address` VARCHAR(255) DEFAULT NULL COMMENT 'Address',
    
    -- Transaction information
    `tx_id` VARCHAR(64) DEFAULT NULL COMMENT 'On-chain transaction ID',
    `pin_id` VARCHAR(255) NOT NULL COMMENT 'Pin ID',
    `path` VARCHAR(255) NOT NULL COMMENT 'MetaID path',
    `content_type` VARCHAR(100) DEFAULT NULL COMMENT 'Content type',
    `operation` VARCHAR(20) DEFAULT NULL COMMENT 'Operation type',
    
    -- Storage information
    `storage_type` VARCHAR(20) DEFAULT NULL COMMENT 'Storage type',
    `storage_path` VARCHAR(500) DEFAULT NULL COMMENT 'Storage path',
    
    -- Transaction data
    `pre_tx_raw` TEXT COMMENT 'Pre-transaction raw data',
    `tx_raw` TEXT COMMENT 'Transaction raw data',
    `status` VARCHAR(20) DEFAULT NULL COMMENT 'Status',
    
    -- Block information
    `block_height` BIGINT DEFAULT NULL COMMENT 'Block height',
    
    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation time',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update time',
    `state` INT(11) DEFAULT 0 COMMENT 'Status',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_file_id` (`file_id`),
    UNIQUE KEY `uk_tx_id` (`tx_id`),
    KEY `idx_pin_id` (`pin_id`),
    KEY `idx_path` (`path`),
    KEY `idx_meta_id` (`meta_id`),
    KEY `idx_block_height` (`block_height`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='File metadata table(Indexerfor query)';

-- =============================================
-- File chunk table (tb_file_chunk) - Indexer query use
-- =============================================
CREATE TABLE IF NOT EXISTS `tb_file_chunk` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'Primary key ID',
    
    -- Chunk information
    `chunk_hash` VARCHAR(80) DEFAULT NULL COMMENT 'Chunk hash',
    `chunk_size` BIGINT DEFAULT NULL COMMENT 'Chunk size',
    `chunk_md5` VARCHAR(191) DEFAULT NULL COMMENT 'Chunk MD5',
    `chunk_index` BIGINT DEFAULT NULL COMMENT 'Chunk index',
    `file_hash` VARCHAR(80) DEFAULT NULL COMMENT 'Belonging file hash',
    
    -- Content
    `content_hex` TEXT COMMENT 'Content hexadecimal',
    
    -- Transaction information
    `tx_id` VARCHAR(64) NOT NULL COMMENT 'On-chain transaction ID',
    `pin_id` VARCHAR(80) NOT NULL COMMENT 'Pin ID',
    `path` VARCHAR(191) NOT NULL COMMENT 'MetaID path',
    `content_type` VARCHAR(100) DEFAULT NULL COMMENT 'Content type',
    `size` BIGINT DEFAULT NULL COMMENT 'Size',
    `operation` VARCHAR(20) DEFAULT NULL COMMENT 'Operation type',
    
    -- Storage information
    `storage_type` VARCHAR(20) DEFAULT NULL COMMENT 'Storage type',
    `storage_path` VARCHAR(500) DEFAULT NULL COMMENT 'Storage path',
    
    -- Transaction data
    `tx_raw` TEXT COMMENT 'Transaction raw data',
    `status` VARCHAR(20) DEFAULT NULL COMMENT 'Status',
    
    -- Block information
    `block_height` BIGINT DEFAULT NULL COMMENT 'Block height',
    
    -- Timestamps
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation time',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update time',
    `state` INT(11) DEFAULT 0 COMMENT 'Status',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tx_id` (`tx_id`),
    KEY `idx_pin_id` (`pin_id`),
    KEY `idx_path` (`path`),
    KEY `idx_file_hash` (`file_hash`),
    KEY `idx_chunk_index` (`chunk_index`),
    KEY `idx_block_height` (`block_height`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='File chunk table(Indexerfor query)';

-- =============================================
-- Index notes
-- =============================================
-- Note:
-- 1. VARCHAR field length limited to within characters(utf8mb4 index limit under 767 bytes)
-- 2. use prefix index for extra long fields，e.g. idx_pin_id (pin_id(100))
-- 3. unique index fields must control length within

-- =============================================
-- Composite index optimization(optional, add based on query needs)
-- =============================================
-- query all files by user(by time descending)
-- ALTER TABLE tb_file ADD INDEX idx_meta_id_created (meta_id, created_at DESC);

-- query files by specific path
-- ALTER TABLE tb_file ADD INDEX idx_path_status (path(100), status);

-- query files by specific block height
-- ALTER TABLE tb_file ADD INDEX idx_height_created (block_height, created_at DESC);

-- statistics analysis index
-- ALTER TABLE tb_file ADD INDEX idx_file_type_status (file_type, status);

-- =============================================
-- View(optional)- for easy querying
-- =============================================
-- successful files view
-- CREATE OR REPLACE VIEW v_success_files AS
-- SELECT 
--     id, file_id, file_name, file_hash, file_size, file_type,
--     meta_id, address, tx_id, path, operation,
--     block_height, created_at
-- FROM tb_file
-- WHERE status = 'success' AND state = 0;

-- pending files view
-- CREATE OR REPLACE VIEW v_pending_files AS
-- SELECT 
--     id, file_id, file_name, file_hash, file_size,
--     meta_id, address, path, operation,
--     created_at, updated_at
-- FROM tb_file
-- WHERE status = 'pending' AND state = 0;

