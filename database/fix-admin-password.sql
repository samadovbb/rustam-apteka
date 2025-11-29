-- Fix Admin Password
-- This script updates the admin password to 'admin123'
-- The hash below is bcrypt hash of 'admin123' with 10 rounds

USE megadent_pos;

-- Delete existing admin if exists
DELETE FROM admins WHERE login = 'admin';

-- Insert admin with correct password hash for 'admin123'
INSERT INTO admins (login, password, full_name) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator');

-- Verify the admin was created
SELECT id, login, full_name, created_at FROM admins WHERE login = 'admin';
