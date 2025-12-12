-- Add seller_penalties table to track monthly penalties for outstanding debts

CREATE TABLE IF NOT EXISTS seller_penalties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    sale_id INT NOT NULL,
    penalty_date DATE NOT NULL COMMENT 'End of month when penalty is calculated',
    remaining_debt DECIMAL(12, 2) NOT NULL COMMENT 'Debt amount at time of penalty',
    penalty_amount DECIMAL(12, 2) NOT NULL COMMENT '1% of remaining debt',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    INDEX idx_seller_date (seller_id, penalty_date),
    INDEX idx_sale (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

