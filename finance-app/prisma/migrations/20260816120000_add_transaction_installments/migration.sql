-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentTotalAmount" DECIMAL(18,2),
ADD COLUMN     "totalInstallments" INTEGER;
