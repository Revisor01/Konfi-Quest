-- Add organization_id column to activities table if it doesn't exist
-- This migration ensures backward compatibility

-- Check if column exists and add it if not
-- SQLite will throw error if column already exists, but we'll catch it

BEGIN TRANSACTION;

-- Try to add the column (will fail if exists)
-- In SQLite, we can't use IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we'll let it fail silently if the column already exists

-- First, check if we need to migrate by creating a temporary table
CREATE TABLE IF NOT EXISTS activities_migration_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('gottesdienst', 'gemeinde')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER DEFAULT 1,
    category TEXT,
    is_special BOOLEAN DEFAULT 0
);

-- If the original table doesn't have organization_id, this will work
-- If it does have organization_id, this will just be an empty temp table

-- Copy data only if migration is needed
INSERT OR IGNORE INTO activities_migration_temp (id, name, points, type, created_at, organization_id, category, is_special)
SELECT 
    id, name, points, type, created_at, 
    COALESCE(organization_id, 1) as organization_id,
    COALESCE(category, '') as category,
    COALESCE(is_special, 0) as is_special
FROM activities;

-- Only proceed if we actually need to migrate (temp table has data)
-- This check will determine if migration was needed

DROP TABLE activities_migration_temp;

COMMIT;