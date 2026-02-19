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

  const rows = await prisma.helpdeskTipoSolicitacao.findMany({
    where: { clientId },
    include: {
      parent: { select: { nome: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
    },
    orderBy: [{ nome: "asc" }],
  });

  const result = rows.map((t) => ({
    id: t.id,
    nome: t.nome,
    parent_nome: t.parent?.nome ?? null,
    group_id: t.groupId,
    group_nome: t.group?.name ?? null,
    sector_id: t.sectorId,
    sector_nome: t.sector?.name ?? null,
    status: t.status,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }));

  return NextResponse.json(result);
}

/** POST /api/helpdesk/tipos — create tipo */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  let body: { clientId: string; nome: string; groupId?: string | null; sectorId?: string | null; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { clientId, nome, groupId, sectorId, status = "A" } = body;
  if (!clientId || !nome?.trim()) return NextResponse.json({ error: "clientId e nome obrigatórios" }, { status: 400 });
  if (status !== "A" && status !== "I") return NextResponse.json({ error: "status deve ser A ou I" }, { status: 400 });

  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const inserted = await prisma.helpdeskTipoSolicitacao.create({
    data: {
      clientId,
      nome: nome.trim(),
      groupId: groupId || null,
      sectorId: sectorId || null,
      status,
    },
  });

  await logAudit({
    userId,
    action: "create",
    entity: "HelpdeskTipoSolicitacao",
    entityId: inserted.id,
    details: JSON.stringify({ clientId, nome: nome.trim() }),
  });

  return NextResponse.json({
    id: inserted.id,
    nome: inserted.nome,
    group_id: inserted.groupId,
    sector_id: inserted.sectorId,
    status: inserted.status,
    created_at: inserted.createdAt,
    updated_at: inserted.updatedAt,
  });
}
