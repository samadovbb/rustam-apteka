-- Add profit tracking columns to sale_items table
-- This allows us to calculate profit for each sale by storing the purchase price at time of sale

ALTER TABLE sale_items
ADD COLUMN purchase_price_at_sale DECIMAL(10, 2) DEFAULT 0 COMMENT 'Sotish paytidagi sotib olish narxi',
ADD COLUMN intake_date DATE NULL COMMENT 'Mahsulotning oxirgi kirish sanasi';

-- Add index for better query performance
CREATE INDEX idx_sale_items_intake_date ON sale_items(intake_date);

-- Note: Existing records will have purchase_price_at_sale = 0 and intake_date = NULL
-- New sales will populate these fields automatically
