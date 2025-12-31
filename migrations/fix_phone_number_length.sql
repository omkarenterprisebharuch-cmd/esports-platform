-- Migration: Increase phone_number column length for encrypted values
-- Created: December 31, 2025
-- Purpose: Encrypted phone numbers are longer than 20 characters

ALTER TABLE users ALTER COLUMN phone_number TYPE VARCHAR(255);
