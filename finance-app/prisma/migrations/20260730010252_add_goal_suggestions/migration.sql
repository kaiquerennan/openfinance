-- CreateTable
CREATE TABLE "GoalSuggestion" (
    "transactionId" TEXT NOT NULL,
    "goalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalSuggestion_pkey" PRIMARY KEY ("transactionId")
);
