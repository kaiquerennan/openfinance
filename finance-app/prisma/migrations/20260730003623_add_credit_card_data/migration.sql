-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "availableCreditLimit" DECIMAL(18,2),
ADD COLUMN     "balanceCloseDate" TIMESTAMP(3),
ADD COLUMN     "balanceDueDate" TIMESTAMP(3),
ADD COLUMN     "cardBrand" TEXT,
ADD COLUMN     "cardLevel" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(18,2),
ADD COLUMN     "minimumPayment" DECIMAL(18,2);
