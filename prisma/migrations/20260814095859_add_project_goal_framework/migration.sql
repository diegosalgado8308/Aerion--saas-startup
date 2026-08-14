-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "goalFramework" TEXT,
ADD COLUMN     "goalStageValues" JSONB NOT NULL DEFAULT '{}';
