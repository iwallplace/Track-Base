-- Supabase SQL Editor'de çalıştırın
-- Bu SQL dosyası Prisma şemasından oluşturulmuştur

-- User tablosu
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT,
    "email" TEXT UNIQUE,
    "username" TEXT NOT NULL UNIQUE,
    "image" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- InventoryItem tablosu
CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "company" TEXT,
    "waybillNo" TEXT NOT NULL,
    "materialReference" TEXT NOT NULL,
    "stockCount" INTEGER NOT NULL,
    "lastAction" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedBy" TEXT
);

-- RolePermission tablosu
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("role", "permission")
);

-- İndeksler
CREATE INDEX IF NOT EXISTS "InventoryItem_materialReference_idx" ON "InventoryItem"("materialReference");
CREATE INDEX IF NOT EXISTS "InventoryItem_company_idx" ON "InventoryItem"("company");
CREATE INDEX IF NOT EXISTS "InventoryItem_waybillNo_idx" ON "InventoryItem"("waybillNo");
CREATE INDEX IF NOT EXISTS "InventoryItem_date_idx" ON "InventoryItem"("date");
CREATE INDEX IF NOT EXISTS "InventoryItem_createdAt_idx" ON "InventoryItem"("createdAt");

-- Admin kullanıcısı oluştur (şifre: admin123 - bcrypt hash)
INSERT INTO "User" ("id", "name", "email", "username", "password", "role")
VALUES (
    'admin-user-id',
    'Admin',
    'admin@example.com',
    'admin',
    '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u',
    'ADMIN'
) ON CONFLICT ("username") DO NOTHING;
