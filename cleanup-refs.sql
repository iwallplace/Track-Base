-- Existing duplicate references cleanup script
-- This script will:
-- 1. Trim whitespace from all material references
-- 2. Convert all material references to UPPERCASE (SAP style)
-- This ensures '121 ', '121', and 'Ref' vs 'REF' are merged into single groups on the dashboard.

UPDATE "InventoryItem"
SET "materialReference" = UPPER(TRIM("materialReference"));

-- Optional: Verify the results
-- SELECT DISTINCT "materialReference" FROM "InventoryItem";
