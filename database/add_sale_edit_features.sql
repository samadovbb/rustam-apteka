-- Add sale returns table to track returned items
CREATE TABLE IF NOT EXISTS sale_returns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    sale_item_id INT NOT NULL,
    quantity INT NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(255) DEFAULT NULL,
    returned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    returned_by VARCHAR(100) DEFAULT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
    INDEX idx_sale_returns_sale_id (sale_id),
    INDEX idx_sale_returns_date (returned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add seller_changed_at to sales table to track seller changes
ALTER TABLE sales
ADD COLUMN seller_changed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Sotuvchi o\'zgartirilgan vaqt',
ADD COLUMN original_seller_id INT NULL DEFAULT NULL COMMENT 'Asl sotuvchi ID';

-- Add grace_period_changed_at to debts table to track grace period changes
ALTER TABLE debts
ADD COLUMN grace_period_changed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Imtiyoz muddati o\'zgartirilgan vaqt',
ADD COLUMN original_grace_period_months INT NULL DEFAULT NULL COMMENT 'Asl imtiyoz muddati';
