import { Pool } from "pg";
import { prisma } from "./prisma";

export type DbConnectionType = "postgres" | "firebird";

export type ClientDbCredentials = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/** Conexão fixa para Alteração de Despesa - banco PMG (Rede PMG) */
export async function getPmgDbConnection(): Promise<ClientDbCredentials> {
  const client = await prisma.client.findFirst({
    where: {
      deletedAt: null,
      status: "active",
      OR: [
        { name: { contains: "PMG", mode: "insensitive" } },
        { name: { contains: "Rede PMG", mode: "insensitive" } },
      ],
    },
    include: { dbConnections: { where: { type: "postgres", status: "active" }, take: 1 } },
  });
  const conn = client?.dbConnections?.[0];
  if (!conn) {
    throw new Error("Nenhuma conexão PostgreSQL ativa encontrada para o cliente PMG");
  }
  return {
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
  };
}

export async function getPmgClientId(): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: {
      deletedAt: null,
      status: "active",
      OR: [
        { name: { contains: "PMG", mode: "insensitive" } },
        { name: { contains: "Rede PMG", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return client?.id ?? null;
}

export async function getClientDbConnection(
  clientId: string,
  toolSlug = "alteracao-despesa"
): Promise<ClientDbCredentials> {
  const tool = await prisma.tool.findFirst({
    where: {
      clientId,
      slug: toolSlug,
      status: "active",
      dbConnectionId: { not: null },
      client: { deletedAt: null },
    },
    include: { dbConnection: true },
  });

  if (tool?.dbConnection && tool.dbConnection.type === "postgres" && tool.dbConnection.status === "active") {
    return {
      host: tool.dbConnection.host,
      port: tool.dbConnection.port,
      user: tool.dbConnection.user,
      password: tool.dbConnection.password,
      database: tool.dbConnection.database,
    };
  }

  const conn = await prisma.dbConnection.findFirst({
    where: { clientId, type: "postgres", status: "active" },
  });
  if (!conn) {
    throw new Error("Nenhuma conexão PostgreSQL ativa encontrada para o cliente");
  }
  return {
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
  };
}

export interface ConnectionParams {
  type: DbConnectionType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  extraParams?: string;
}

export async function testPostgresConnection(
  params: Omit<ConnectionParams, "type">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const pool = new Pool({
      host: params.host,
      port: params.port,
      user: params.user,
      password: params.password,
      database: params.database,
      connectionTimeoutMillis: 5000,
    });
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, message };
  }
}

export async function testFirebirdConnection(
  params: Omit<ConnectionParams, "type">
): Promise<{ ok: boolean; message?: string }> {
  try {
    const Firebird = (await import("node-firebird")).default;
    const opts = {
      host: params.host,
      port: params.port,
      database: params.database,
      user: params.user,
      password: params.password,
    };
    return await new Promise((resolve) => {
      Firebird.attach(opts, (err: Error | null, db: { detach: (cb: () => void) => void }) => {
        if (err) resolve({ ok: false, message: err.message });
        else db.detach(() => resolve({ ok: true }));
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, message };
  }
}

export async function testConnection(params: ConnectionParams): Promise<{ ok: boolean; message?: string }> {
  if (params.type === "postgres") return testPostgresConnection(params);
  if (params.type === "firebird") return testFirebirdConnection(params);
  return { ok: false, message: "Tipo não suportado" };
}
