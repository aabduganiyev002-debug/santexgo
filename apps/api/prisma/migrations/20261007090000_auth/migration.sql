-- CreateEnum
CREATE TYPE "verification_purpose" AS ENUM ('REGISTER', 'RESET_PASSWORD', 'CHANGE_PHONE');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "previous_token_hash" VARCHAR(128),
ADD COLUMN     "rotated_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "purpose" "verification_purpose" NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_codes_phone_purpose_created_at_idx" ON "verification_codes"("phone", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "verification_codes_ip_address_created_at_idx" ON "verification_codes"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "verification_codes_created_at_idx" ON "verification_codes"("created_at");

-- CreateIndex
CREATE INDEX "sessions_previous_token_hash_idx" ON "sessions"("previous_token_hash");


-- ──────────────────────────────────────────────────────────────────────────────
-- SantexGo: qo'shimcha himoya qoidalari
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_attempts_check"
    CHECK ("attempts" >= 0);
