import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser } from "@/lib/helpdesk";
import { logAudit } from "@/lib/audit";

async function checkCanAccessHelpdesk(userId: string, clientId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "admin") return true;
  const clientIds = await getClientIdsForUser(userId);
  return clientIds.has(clientId);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { id } = await context.params;
  let body: { clientId: string; nome?: string; groupId?: string | null; sectorId?: string | null; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { clientId, nome, groupId, sectorId, status } = body;
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  if (status !== undefined && status !== "A" && status !== "I") return NextResponse.json({ error: "status deve ser A ou I" }, { status: 400 });

  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const existing = await prisma.helpdeskTipoSolicitacao.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) return NextResponse.json({ error: "Tipo não encontrado" }, { status: 404 });

  if (sectorId) {
    const sector = await prisma.sector.findUnique({ where: { id: sectorId }, select: { groupId: true, group: { select: { clientId: true } } } });
    if (!sector) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 400 });
    if (sector.group.clientId !== clientId) return NextResponse.json({ error: "Grupo não pertence ao cliente" }, { status: 400 });
    if (groupId && sector.groupId !== groupId) return NextResponse.json({ error: "Grupo não pertence ao Setor informado" }, { status: 400 });
  }
  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { clientId: true } });
    if (!group) return NextResponse.json({ error: "Setor não encontrado" }, { status: 400 });
    if (group.clientId !== clientId) return NextResponse.json({ error: "Setor não pertence ao cliente" }, { status: 400 });
  }

  const data: { nome?: string; groupId?: string | null; sectorId?: string | null; status?: string } = {};
  if (nome !== undefined) {
    if (!nome.trim()) return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 });
    data.nome = nome.trim();
  }
  if (groupId !== undefined) data.groupId = groupId || null;
  if (sectorId !== undefined) data.sectorId = sectorId || null;
  if (status !== undefined) data.status = status;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({
      id: existing.id,
      nome: existing.nome,
      group_id: existing.groupId,
      sector_id: existing.sectorId,
      status: existing.status,
      created_at: existing.createdAt,
      updated_at: existing.updatedAt,
    });
  }

  const updated = await prisma.helpdeskTipoSolicitacao.update({
    where: { id },
    data,
  });

  await logAudit({ userId, action: "update", entity: "HelpdeskTipoSolicitacao", entityId: id, details: JSON.stringify({ clientId }) });

  return NextResponse.json({
    id: updated.id,
    nome: updated.nome,
    group_id: updated.groupId,
    sector_id: updated.sectorId,
    status: updated.status,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  });
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

  const existing = await prisma.helpdeskTipoSolicitacao.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) return NextResponse.json({ error: "Tipo não encontrado" }, { status: 404 });

  const children = await prisma.helpdeskTipoSolicitacao.count({ where: { parentId: id } });
  if (children > 0) return NextResponse.json({ error: "Não é possível excluir: existem subcategorias vinculadas. Inative o tipo." }, { status: 400 });

  await prisma.helpdeskTipoSolicitacao.update({
    where: { id },
    data: { status: "I" },
  });

  await logAudit({ userId, action: "delete", entity: "HelpdeskTipoSolicitacao", entityId: id, details: JSON.stringify({ clientId }) });
  return NextResponse.json({ ok: true });
}
