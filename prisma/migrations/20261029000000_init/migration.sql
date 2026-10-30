-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WineProject" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "vintage" INTEGER,
    "vineyard" TEXT,
    "origin" TEXT,
    "volumeLiters" DOUBLE PRECISION,
    "alcohol" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "estimatedAgingMonths" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "storyVisible" BOOLEAN NOT NULL DEFAULT false,
    "originKnowledgeKey" TEXT,
    "varietyKnowledgeKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicToken" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "WineProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barrel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT,
    "brand" TEXT,
    "origin" TEXT,
    "toastLevel" TEXT,
    "volumeLiters" DOUBLE PRECISION,
    "contents" TEXT,
    "status" TEXT NOT NULL DEFAULT 'filled',
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oakOriginKnowledgeKey" TEXT,
    "toastLevelKnowledgeKey" TEXT,
    "pinHash" TEXT,
    "pinSetAt" TIMESTAMP(3),
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "accessRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Barrel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'recurring',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "systemKey" TEXT,

    CONSTRAINT "OperationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "barrelId" TEXT,
    "operationTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "customerHeadline" TEXT,
    "customerNote" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabControl" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "brix" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "totalSo2" DOUBLE PRECISION,
    "volatileAcid" DOUBLE PRECISION,
    "sensoryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "operationId" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "caption" TEXT,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BottlingRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bottlingDate" TIMESTAMP(3) NOT NULL,
    "litersObtained" DOUBLE PRECISION,
    "bottleCount" INTEGER,
    "bottleFormat" TEXT NOT NULL DEFAULT '750ml',
    "labelStatus" TEXT NOT NULL DEFAULT 'undecided',
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BottlingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'app',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,

    CONSTRAINT "CustomerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerStory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTopic" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KnowledgeTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locationLine" TEXT,
    "elevationMeters" INTEGER,
    "teaser" TEXT,
    "factChips" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "sources" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authoredById" TEXT,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePairing" (
    "id" TEXT NOT NULL,
    "entryAId" TEXT NOT NULL,
    "entryBId" TEXT NOT NULL,
    "narrative" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgePairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarrelOwnership" (
    "id" TEXT NOT NULL,
    "barrelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "allocation" INTEGER NOT NULL DEFAULT 0,
    "canEditStory" BOOLEAN NOT NULL DEFAULT true,
    "canGift" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "assignedById" TEXT,

    CONSTRAINT "BarrelOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarrelPinToken" (
    "id" TEXT NOT NULL,
    "barrelId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "BarrelPinToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "barrelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "recipientName" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryRevision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarrelNote" (
    "id" TEXT NOT NULL,
    "barrelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarrelNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WineProject_publicToken_key" ON "WineProject"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "Barrel_number_key" ON "Barrel"("number");

-- CreateIndex
CREATE UNIQUE INDEX "OperationType_name_key" ON "OperationType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OperationType_systemKey_key" ON "OperationType"("systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "LabControl_operationId_key" ON "LabControl"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerStory_projectId_key" ON "CustomerStory"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTopic_key_key" ON "KnowledgeTopic"("key");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEntry_key_key" ON "KnowledgeEntry"("key");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePairing_entryAId_entryBId_key" ON "KnowledgePairing"("entryAId", "entryBId");

-- CreateIndex
CREATE INDEX "BarrelOwnership_barrelId_idx" ON "BarrelOwnership"("barrelId");

-- CreateIndex
CREATE INDEX "BarrelOwnership_ownerId_idx" ON "BarrelOwnership"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BarrelPinToken_tokenHash_key" ON "BarrelPinToken"("tokenHash");

-- CreateIndex
CREATE INDEX "BarrelPinToken_barrelId_idx" ON "BarrelPinToken"("barrelId");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_idempotencyKey_key" ON "Gift"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Gift_projectId_idx" ON "Gift"("projectId");

-- CreateIndex
CREATE INDEX "Gift_ownerId_idx" ON "Gift"("ownerId");

-- CreateIndex
CREATE INDEX "Gift_assignmentId_idx" ON "Gift"("assignmentId");

-- CreateIndex
CREATE INDEX "StoryRevision_projectId_idx" ON "StoryRevision"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "BarrelNote_barrelId_publishedAt_idx" ON "BarrelNote"("barrelId", "publishedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WineProject" ADD CONSTRAINT "WineProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WineProject" ADD CONSTRAINT "WineProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrel" ADD CONSTRAINT "Barrel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "Barrel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "OperationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabControl" ADD CONSTRAINT "LabControl_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BottlingRecord" ADD CONSTRAINT "BottlingRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerStory" ADD CONSTRAINT "CustomerStory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "KnowledgeTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePairing" ADD CONSTRAINT "KnowledgePairing_entryAId_fkey" FOREIGN KEY ("entryAId") REFERENCES "KnowledgeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePairing" ADD CONSTRAINT "KnowledgePairing_entryBId_fkey" FOREIGN KEY ("entryBId") REFERENCES "KnowledgeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarrelOwnership" ADD CONSTRAINT "BarrelOwnership_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "Barrel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarrelOwnership" ADD CONSTRAINT "BarrelOwnership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarrelPinToken" ADD CONSTRAINT "BarrelPinToken_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "Barrel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "Barrel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "BarrelOwnership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryRevision" ADD CONSTRAINT "StoryRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WineProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarrelNote" ADD CONSTRAINT "BarrelNote_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "Barrel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariant Prisma cannot express: an owner may hold several barrels and a barrel several owners, but
-- never two ACTIVE assignments for the same (barrel, owner). History rows (endedAt set) are unconstrained.
CREATE UNIQUE INDEX "BarrelOwnership_one_active_assignment"
  ON "BarrelOwnership"("barrelId", "ownerId") WHERE "endedAt" IS NULL;
