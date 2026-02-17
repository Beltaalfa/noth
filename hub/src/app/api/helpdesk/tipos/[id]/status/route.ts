import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser } from "@/lib/helpdesk";
import { withHelpdeskDb } from "@/lib/helpdesk-db";
import { logAudit } from "@/lib/audit";

async function checkCanAccessHelpdesk(userId: string, clientId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "admin") return true;
  const clientIds = await getClientIdsForUser(userId);
  return clientIds.has(clientId);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id } = await context.params;
  let body: { clientId: string; status: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }
  const { clientId, status } = body;
  if (!clientId) return NextResponse.json({ error: "clientId obrigatorio" }, { status: 400 });
  if (status !== "A" && status !== "I") return NextResponse.json({ error: "status deve ser A ou I" }, { status: 400 });

  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissao" }, { status: 403 });

  try {
    await withHelpdeskDb(clientId, async (pool) => {
      const r = await pool.query("UPDATE hd_tipo_solicitacao SET status = $1, updated_at = now() WHERE id = $2 RETURNING id", [status, id]);
      if (r.rows.length === 0) throw new Error("Tipo nao encontrado");
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await logAudit({ userId, action: status === "A" ? "activate" : "inactivate", entity: "HelpdeskTipoSolicitacao", entityId: id, details: JSON.stringify({ clientId, status }) });

  const row = await withHelpdeskDb(clientId, async (pool) => {
    const r = await pool.query("SELECT id, nome, parent_id, status, ordem, created_at, updated_at FROM hd_tipo_solicitacao WHERE id = $1", [id]);
    return r.rows[0];
  });
  return NextResponse.json(row);
}
