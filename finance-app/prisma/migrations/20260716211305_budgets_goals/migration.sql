-- CreateTable
CREATE TABLE "Budget" (
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🎯',
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "initialAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlyContribution" DECIMAL(18,2),
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalEntry" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoalEntry_goalId_month_key" ON "GoalEntry"("goalId", "month");

-- AddForeignKey
ALTER TABLE "GoalEntry" ADD CONSTRAINT "GoalEntry_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
