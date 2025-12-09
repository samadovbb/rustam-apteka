-- Migration: Allow NULL for markup_type and markup_value in debts table
-- This allows creating debts without markup/interest

ALTER TABLE debts
MODIFY COLUMN markup_type ENUM('fixed', 'percent') NULL COMMENT 'NULL means no markup';

ALTER TABLE debts
MODIFY COLUMN markup_value DECIMAL(12, 2) NULL COMMENT 'Fixed amount or percentage';
