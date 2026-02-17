/**
 * One-shot migration: for each client (without HelpdeskTenant), create tenant DB,
 * run helpdesk migrations, seed tipos, copy existing helpdesk data from central, register HelpdeskTenant.
 * Run from hub: npm run migrate-helpdesk
 * Requires DATABASE_URL in .env (loaded automatically via dotenv).
 */
import "dotenv/config";

import { Pool } from "pg";
import { prisma } from "../src/lib/prisma";
import {
  helpdeskDbName,
  parseCentralDbUrl,
  createHelpdeskDatabase,
  runHelpdeskMigrations,
} from "../src/lib/helpdesk-db";
import { seedHelpdeskTiposSolicitacao } from "../src/lib/helpdesk-seed-tipos";

async function main() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  console.log(`Clientes ativos: ${clients.length}`);

  const params = parseCentralDbUrl();

  for (const client of clients) {
    const existing = await prisma.helpdeskTenant.findUnique({
      where: { clientId: client.id },
    });
    if (existing) {
      console.log(`[${client.name}] Já possui tenant, pulando.`);
      continue;
    }

    const dbName = helpdeskDbName(client.id);
    console.log(`[${client.name}] Criando banco ${dbName}...`);

    try {
      await createHelpdeskDatabase(dbName);
    } catch (e: unknown) {
      console.error(`[${client.name}] Erro ao criar banco:`, e);
      continue;
    }

    const pool = new Pool({
      host: params.host,
      port: params.port,
      user: params.user,
      password: params.password,
      database: dbName,
      ssl: params.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15000,
    });

    try {
      await runHelpdeskMigrations(pool);
      await seedHelpdeskTiposSolicitacao(pool);
    } catch (e: unknown) {
      console.error(`[${client.name}] Erro em migrations/seed:`, e);
      await pool.end();
      continue;
    }

    const tickets = await prisma.helpdeskTicket.findMany({
      where: { clientId: client.id },
      include: {
        messages: { include: { attachments: true } },
        notifications: true,
        approvalLogs: true,
      },
    });

    const configs = await prisma.helpdeskApprovalConfig.findMany({
      where: { clientId: client.id },
      include: { approvers: true },
    });

    const clientConn = await pool.connect();
    try {
      for (const t of tickets) {
        await clientConn.query(
          `INSERT INTO hd_ticket (id, client_id, subject, status, assignee_type, assignee_user_id, assignee_group_id, assignee_sector_id, created_by_id, sla_limit_hours, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            t.id,
            t.clientId,
            t.subject ?? null,
            t.status,
            t.assigneeType,
            t.assigneeUserId ?? null,
            t.assigneeGroupId ?? null,
            t.assigneeSectorId ?? null,
            t.createdById,
            t.slaLimitHours ?? null,
            t.createdAt,
            t.updatedAt,
          ]
        );
        for (const m of t.messages) {
          await clientConn.query(
            `INSERT INTO hd_message (id, ticket_id, user_id, content, forwarded_from_message_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [m.id, m.ticketId, m.userId, m.content, m.forwardedFromMessageId ?? null, m.createdAt]
          );
          for (const a of m.attachments) {
            await clientConn.query(
              `INSERT INTO hd_attachment (id, message_id, filename, mime_type, size, storage_path, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [a.id, a.messageId, a.filename, a.mimeType, a.size, a.storagePath, a.createdAt]
            );
          }
        }
        for (const n of t.notifications) {
          await clientConn.query(
            `INSERT INTO hd_notification (id, user_id, ticket_id, message_id, type, read_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [n.id, n.userId, n.ticketId, n.messageId ?? null, n.type, n.readAt ?? null, n.createdAt]
          );
        }
        for (const log of t.approvalLogs) {
          await clientConn.query(
            `INSERT INTO hd_approval_log (id, ticket_id, user_id, action, comment, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [log.id, log.ticketId, log.userId, log.action, log.comment ?? null, log.createdAt]
          );
        }
      }

      for (const c of configs) {
        await clientConn.query(
          `INSERT INTO hd_approval_config (id, client_id, group_id, sector_id, exige_aprovacao, tipo_aprovacao, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            c.id,
            c.clientId,
            c.groupId ?? null,
            c.sectorId ?? null,
            c.exigeAprovacao,
            c.tipoAprovacao,
            c.createdAt,
            c.updatedAt,
          ]
        );
        for (const app of c.approvers) {
          await clientConn.query(
            `INSERT INTO hd_approval_config_approver (id, config_id, user_id, ordem, nivel, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [app.id, app.configId, app.userId, app.ordem ?? null, app.nivel ?? null, app.createdAt]
          );
        }
      }
    } catch (e: unknown) {
      console.error(`[${client.name}] Erro ao copiar dados:`, e);
      clientConn.release();
      await pool.end();
      continue;
    }
    clientConn.release();

    await prisma.helpdeskTenant.create({
      data: {
        clientId: client.id,
        dbName,
        dbHost: params.host,
        dbPort: params.port,
        dbUser: params.user,
        dbPassword: params.password,
        dbSsl: params.ssl,
      },
    });
    console.log(`[${client.name}] Tenant criado: ${tickets.length} tickets, ${configs.length} configs.`);
    await pool.end();
  }

  console.log("Migração concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
