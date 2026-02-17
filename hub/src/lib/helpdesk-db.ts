import { Pool } from "pg";
import { prisma } from "./prisma";
import path from "path";
import fs from "fs";

export type HelpdeskTenantCredentials = {
  dbName: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbSsl: boolean;
};

/** Get tenant credentials from central DB. Throws if not found. */
export async function getHelpdeskTenant(clientId: string): Promise<HelpdeskTenantCredentials> {
  const tenant = await prisma.helpdeskTenant.findUnique({
    where: { clientId },
  });
  if (!tenant) {
    throw new Error(`Helpdesk tenant não encontrado para o cliente ${clientId}. Execute o provisionamento ou a migração.`);
  }
  return {
    dbName: tenant.dbName,
    dbHost: tenant.dbHost,
    dbPort: tenant.dbPort,
    dbUser: tenant.dbUser,
    dbPassword: tenant.dbPassword,
    dbSsl: tenant.dbSsl,
  };
}

/** Execute a function with a connection to the client's Helpdesk DB. Pool is always closed in finally. */
export async function withHelpdeskDb<T>(clientId: string, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const creds = await getHelpdeskTenant(clientId);
  const pool = new Pool({
    host: creds.dbHost,
    port: creds.dbPort,
    user: creds.dbUser,
    password: creds.dbPassword,
    database: creds.dbName,
    ssl: creds.dbSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "helpdesk-migrations");

/** Run all helpdesk SQL migrations on the given pool. Idempotent via helpdesk_schema_migrations. */
export async function runHelpdeskMigrations(pool: Pool): Promise<void> {
  await ensureMigrationsTable(pool);
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const version = file;
      const { rows } = await client.query(
        "SELECT 1 FROM helpdesk_schema_migrations WHERE version = $1",
        [version]
      ).catch(() => ({ rows: [] }));
      if (rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO helpdesk_schema_migrations (version, applied_at) VALUES ($1, now())",
          [version]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

/** Create the initial helpdesk_schema_migrations table if it doesn't exist (for fresh DBs). */
export async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS helpdesk_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/** Build tenant DB name from clientId: helpdesk_<sanitized> (only _ for non-alphanumeric). */
export function helpdeskDbName(clientId: string): string {
  const sanitized = clientId.replace(/[^a-zA-Z0-9]/g, "_");
  return `helpdesk_${sanitized}`;
}

/** Parse DATABASE_URL into host, port, user, password, ssl for provisioning. */
export function parseCentralDbUrl(): { host: string; port: number; user: string; password: string; database: string; ssl: boolean } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for helpdesk provisioning");
  const u = new URL(url);
  const port = u.port ? parseInt(u.port, 10) : 5432;
  const ssl = u.searchParams.get("sslmode") === "require" || u.protocol === "postgresql:";
  return {
    host: u.hostname,
    port,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1).replace(/\/.*$/, "") || "postgres",
    ssl,
  };
}

/** Create a new PostgreSQL database (connect to 'postgres' and CREATE DATABASE). */
export async function createHelpdeskDatabase(dbName: string): Promise<void> {
  const params = parseCentralDbUrl();
  const pool = new Pool({
    host: params.host,
    port: params.port,
    user: params.user,
    password: params.password,
    database: "postgres",
    ssl: params.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    client.release();
    await pool.end();
  }
}
