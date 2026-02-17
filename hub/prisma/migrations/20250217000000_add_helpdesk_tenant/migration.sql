-- CreateTable
CREATE TABLE "HelpdeskTenant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "dbHost" TEXT NOT NULL,
    "dbPort" INTEGER NOT NULL,
    "dbUser" TEXT NOT NULL,
    "dbPassword" TEXT NOT NULL,
    "dbSsl" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpdeskTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HelpdeskTenant_clientId_key" ON "HelpdeskTenant"("clientId");

-- CreateIndex
CREATE INDEX "HelpdeskTenant_clientId_idx" ON "HelpdeskTenant"("clientId");

-- AddForeignKey
ALTER TABLE "HelpdeskTenant" ADD CONSTRAINT "HelpdeskTenant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
