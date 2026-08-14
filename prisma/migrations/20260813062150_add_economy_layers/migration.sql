-- AlterTable
ALTER TABLE "EconomyNode" ADD COLUMN     "layerId" TEXT;

-- CreateTable
CREATE TABLE "EconomyLayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagramId" TEXT NOT NULL,

    CONSTRAINT "EconomyLayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EconomyLayer_diagramId_idx" ON "EconomyLayer"("diagramId");

-- CreateIndex
CREATE INDEX "EconomyNode_layerId_idx" ON "EconomyNode"("layerId");

-- AddForeignKey
ALTER TABLE "EconomyLayer" ADD CONSTRAINT "EconomyLayer_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "EconomyDiagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EconomyNode" ADD CONSTRAINT "EconomyNode_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "EconomyLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
