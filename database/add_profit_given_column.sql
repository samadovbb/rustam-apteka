-- ============================================
-- Migratsiya: sales jadvaliga profit_given ustunini qo'shish
-- Ushbu SQL ni MySQL da ishga tushiring
-- ============================================

-- profit_given ustuni (0 = berilmagan, 1 = berilgan)
ALTER TABLE sales ADD COLUMN profit_given TINYINT(1) DEFAULT 0 COMMENT '0 = foyda berilmagan, 1 = foyda berilgan';

-- profit_given_at ustuni (foyda berilgan sana)
ALTER TABLE sales ADD COLUMN profit_given_at TIMESTAMP NULL COMMENT 'Foyda berilgan sana';
