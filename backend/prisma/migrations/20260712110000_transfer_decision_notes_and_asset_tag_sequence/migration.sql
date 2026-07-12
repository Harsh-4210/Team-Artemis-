-- AlterTable
ALTER TABLE "TransferRequest" ADD COLUMN "decisionNotes" TEXT;

-- Asset tag sequence used by POST /assets (AF-XXXX). Seed syncs with setval.
CREATE SEQUENCE IF NOT EXISTS asset_tag_sequence START WITH 1 INCREMENT BY 1;
