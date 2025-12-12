-- Migration: Update payment method from 'cash' to 'naqt'
-- This script updates all existing payment records that use 'cash' to use 'naqt' instead

-- First, modify the ENUM to include both 'cash' and 'naqt' temporarily
ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash', 'naqt', 'card', 'transfer', 'other') DEFAULT 'naqt';

-- Update all existing 'cash' records to 'naqt'
UPDATE payments SET payment_method = 'naqt' WHERE payment_method = 'cash';

-- Finally, remove 'cash' from the ENUM, keeping only 'naqt'
ALTER TABLE payments MODIFY COLUMN payment_method ENUM('naqt', 'card', 'transfer', 'other') DEFAULT 'naqt';
