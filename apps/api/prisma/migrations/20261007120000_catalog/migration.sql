-- Trigram qidiruv indeksi uchun (PostgreSQL bilan birga keladigan kengaytma)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "available_stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "search_text" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "products_is_active_available_stock_idx" ON "products"("is_active", "available_stock");

-- CreateIndex
CREATE INDEX "products_search_text_idx" ON "products" USING GIN ("search_text" gin_trgm_ops);


-- ──────────────────────────────────────────────────────────────────────────────
-- SantexGo: sotuvga mavjud qoldiq (products.available_stock) avtomatik hisoblanadi.
-- Har qanday ombor o'zgarishi (kirim, buyurtma bandi, jo'natish, bekor qilish) shu
-- triggerlar orqali mahsulotga yoziladi — kod qayerdan o'zgartirmasin, qiymat to'g'ri qoladi.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE FUNCTION "refresh_product_available_stock"(p_product_id UUID) RETURNS void AS $$
    UPDATE "products" p
    SET "available_stock" = COALESCE((
        SELECT SUM(GREATEST(i."quantity" - i."reserved", 0))
        FROM "inventory" i
        JOIN "warehouses" w ON w."id" = i."warehouse_id"
        WHERE i."product_id" = p_product_id AND w."is_active"
    ), 0)
    WHERE p."id" = p_product_id;
$$ LANGUAGE sql;

CREATE FUNCTION "inventory_sync_available_stock"() RETURNS trigger AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM "refresh_product_available_stock"(NEW."product_id");
    END IF;
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD."product_id" <> NEW."product_id") THEN
        PERFORM "refresh_product_available_stock"(OLD."product_id");
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventory_available_stock"
    AFTER INSERT OR DELETE OR UPDATE OF "quantity", "reserved", "product_id", "warehouse_id"
    ON "inventory"
    FOR EACH ROW EXECUTE FUNCTION "inventory_sync_available_stock"();

-- Ombor faolsizlantirilsa, undagi qoldiq sotuvdan chiqadi (va aksincha)
CREATE FUNCTION "warehouse_sync_available_stock"() RETURNS trigger AS $$
BEGIN
    IF NEW."is_active" IS DISTINCT FROM OLD."is_active" THEN
        PERFORM "refresh_product_available_stock"(i."product_id")
        FROM "inventory" i
        WHERE i."warehouse_id" = NEW."id";
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "warehouses_available_stock"
    AFTER UPDATE OF "is_active" ON "warehouses"
    FOR EACH ROW EXECUTE FUNCTION "warehouse_sync_available_stock"();

-- Mavjud ma'lumotlar uchun boshlang'ich qiymat
SELECT "refresh_product_available_stock"("id") FROM "products";

ALTER TABLE "products" ADD CONSTRAINT "products_available_stock_check" CHECK ("available_stock" >= 0);
