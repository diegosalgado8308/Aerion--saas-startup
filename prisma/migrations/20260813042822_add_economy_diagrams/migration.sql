-- CreateEnum
CREATE TYPE "EconomyNodeType" AS ENUM ('POOL', 'SOURCE', 'DRAIN', 'CONVERTER');

-- CreateTable
CREATE TABLE "EconomyDiagram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "EconomyDiagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EconomyNodeType" NOT NULL,
    "resourceName" TEXT NOT NULL,
    "initialValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagramId" TEXT NOT NULL,

    CONSTRAINT "EconomyNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyConnection" (
    "id" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "rateVariance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagramId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,

    CONSTRAINT "EconomyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EconomyDiagram_projectId_idx" ON "EconomyDiagram"("projectId");

-- CreateIndex
CREATE INDEX "EconomyNode_diagramId_idx" ON "EconomyNode"("diagramId");

-- CreateIndex
CREATE INDEX "EconomyConnection_diagramId_idx" ON "EconomyConnection"("diagramId");

-- CreateIndex
CREATE INDEX "EconomyConnection_fromNodeId_idx" ON "EconomyConnection"("fromNodeId");

-- CreateIndex
CREATE INDEX "EconomyConnection_toNodeId_idx" ON "EconomyConnection"("toNodeId");

-- AddForeignKey
ALTER TABLE "EconomyDiagram" ADD CONSTRAINT "EconomyDiagram_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyNode" ADD CONSTRAINT "EconomyNode_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "EconomyDiagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyConnection" ADD CONSTRAINT "EconomyConnection_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "EconomyDiagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyConnection" ADD CONSTRAINT "EconomyConnection_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "EconomyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyConnection" ADD CONSTRAINT "EconomyConnection_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "EconomyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
