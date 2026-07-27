-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT,
    "subtype" TEXT,
    "name" TEXT,
    "balance" DECIMAL(18,2),
    "amount" DECIMAL(18,2),
    "currencyCode" TEXT,
    "status" TEXT,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investment_itemId_idx" ON "Investment"("itemId");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
