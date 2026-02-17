import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser } from "@/lib/helpdesk";
import { withHelpdeskDb } from "@/lib/helpdesk-db";
import { logAudit } from "@/lib/audit";
import { randomBytes } from "crypto";

function cuidLike(): string {
  const t = Date.now().toString(36);
  const r = randomBytes(6).toString("hex");
  return `c${t}${r}`.slice(0, 25);
}

async function checkCanAccessHelpdesk(userId: string, clientId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "admin") return true;
  const clientIds = await getClientIdsForUser(userId);
  return clientIds.has(clientId);
}

/** GET /api/helpdesk/tipos?clientId=xxx — list with parent_nome */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });

  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    const rows = await withHelpdeskDb(clientId, async (pool) => {
      const r = await pool.query(
        `SELECT t.id, t.nome, t.parent_id, t.status, t.ordem, t.created_at, t.updated_at,
                p.nome AS parent_nome
         FROM hd_tipo_solicitacao t
         LEFT JOIN hd_tipo_solicitacao p ON p.id = t.parent_id
         ORDER BY t.ordem, t.nome`
      );
      return r.rows;
    });
    return NextResponse.json(rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar tipos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/helpdesk/tipos — create tipo */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  let body: { clientId: string; nome: string; parentId?: string | null; ordem?: number; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { clientId, nome, parentId, ordem = 0, status = "A" } = body;
  if (!clientId || !nome?.trim()) return NextResponse.json({ error: "clientId e nome obrigatórios" }, { status: 400 });
  if (status !== "A" && status !== "I") return NextResponse.json({ error: "status deve ser A ou I" }, { status: 400 });

  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const id = cuidLike();
  try {
    await withHelpdeskDb(clientId, async (pool) => {
      await pool.query(
        `INSERT INTO hd_tipo_solicitacao (id, nome, parent_id, status, ordem, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, now(), now())`,
        [id, nome.trim(), parentId || null, status, ordem ?? 0]
      );
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar tipo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await logAudit({
    userId,
    action: "create",
    entity: "HelpdeskTipoSolicitacao",
    entityId: id,
    details: JSON.stringify({ clientId, nome: nome.trim() }),
  });

  const inserted = await withHelpdeskDb(clientId, async (pool) => {
    const r = await pool.query(
      `SELECT id, nome, parent_id, status, ordem, created_at, updated_at FROM hd_tipo_solicitacao WHERE id = $1`,
      [id]
    );
    return r.rows[0];
  });
  return NextResponse.json(inserted);
}
