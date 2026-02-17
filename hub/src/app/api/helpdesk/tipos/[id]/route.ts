import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser } from "@/lib/helpdesk";
import { withHelpdeskDb } from "@/lib/helpdesk-db";
import { logAudit } from "@/lib/audit";
import type { Pool } from "pg";

async function checkCanAccessHelpdesk(userId: string, clientId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "admin") return true;
  const clientIds = await getClientIdsForUser(userId);
  return clientIds.has(clientId);
}

async function getAncestorIds(pool: Pool, nodeId: string): Promise<Set<string>> {
  const seen = new Set<string>();
  let current: string | null = nodeId;
  for (let i = 0; i < 100 && current; i++) {
    const r: { rows: { parent_id: string | null }[] } = await pool.query("SELECT parent_id FROM hd_tipo_solicitacao WHERE id = $1", [current]);
    const parentId = r.rows[0]?.parent_id ?? null;
    if (!parentId) break;
    if (seen.has(parentId)) break;
    seen.add(parentId);
    current = parentId;
  }
  return seen;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { id } = await context.params;
  let body: { clientId: string; nome?: string; parentId?: string | null; ordem?: number; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { clientId, nome, parentId, ordem, status } = body;
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  if (status !== undefined && status !== "A" && status !== "I") return NextResponse.json({ error: "status deve ser A ou I" }, { status: 400 });

  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  try {
    await withHelpdeskDb(clientId, async (pool) => {
      if (parentId !== undefined) {
        if (parentId === id) throw new Error("Categoria não pode ser pai de si mesma");
        if (parentId) {
          const ancestors = await getAncestorIds(pool, id);
          if (ancestors.has(parentId)) throw new Error("Ciclo na hierarquia");
        }
      }
      const updates: string[] = [];
      const values: unknown[] = [];
      let pos = 1;
      if (nome !== undefined) {
        if (!nome.trim()) throw new Error("Nome não pode ser vazio");
        updates.push("nome = $" + pos++);
        values.push(nome.trim());
      }
      if (parentId !== undefined) {
        updates.push("parent_id = $" + pos++);
        values.push(parentId || null);
      }
      if (ordem !== undefined) {
        updates.push("ordem = $" + pos++);
        values.push(ordem);
      }
      if (status !== undefined) {
        updates.push("status = $" + pos++);
        values.push(status);
      }
      if (updates.length === 0) return;
      updates.push("updated_at = now()");
      values.push(id);
      await pool.query("UPDATE hd_tipo_solicitacao SET " + updates.join(", ") + " WHERE id = $" + pos, values);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar tipo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await logAudit({ userId, action: "update", entity: "HelpdeskTipoSolicitacao", entityId: id, details: JSON.stringify({ clientId }) });

  const row = await withHelpdeskDb(clientId, async (pool) => {
    const r = await pool.query("SELECT id, nome, parent_id, status, ordem, created_at, updated_at FROM hd_tipo_solicitacao WHERE id = $1", [id]);
    return r.rows[0];
  });
  if (!row) return NextResponse.json({ error: "Tipo não encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  try {
    await withHelpdeskDb(clientId, async (pool) => {
      const children = await pool.query("SELECT 1 FROM hd_tipo_solicitacao WHERE parent_id = $1 LIMIT 1", [id]);
      if (children.rows.length > 0) throw new Error("Não é possível excluir: existem subcategorias. Inative o tipo.");
      await pool.query("UPDATE hd_tipo_solicitacao SET status = $1, updated_at = now() WHERE id = $2", ["I", id]);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao excluir tipo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  await logAudit({ userId, action: "delete", entity: "HelpdeskTipoSolicitacao", entityId: id, details: JSON.stringify({ clientId }) });
  return NextResponse.json({ ok: true });
}
