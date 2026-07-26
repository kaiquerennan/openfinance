-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "connectorId" INTEGER NOT NULL,
    "connectorName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executionStatus" TEXT,
    "pluggyCreatedAt" TIMESTAMP(3),
    "pluggyUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT,
    "subtype" TEXT,
    "name" TEXT,
    "marketingName" TEXT,
    "number" TEXT,
    "balance" DECIMAL(18,2),
    "currencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "descriptionRaw" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2),
    "currencyCode" TEXT,
    "type" TEXT,
    "category" TEXT,
    "categoryId" TEXT,
    "providerCode" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_itemId_idx" ON "Account"("itemId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
