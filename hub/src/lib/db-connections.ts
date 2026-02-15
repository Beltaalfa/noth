import { Pool } from "pg";

export type DbConnectionType = "postgres" | "firebird";

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
