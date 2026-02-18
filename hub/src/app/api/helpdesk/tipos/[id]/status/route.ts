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
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { clientId, status } = body;
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  if (status !== "A" && status !== "I") return NextResponse.json({ error: "status deve ser A ou I" }, { status: 400 });

  const can = await checkCanAccessHelpdesk(userId, clientId);
  if (!can) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const existing = await prisma.helpdeskTipoSolicitacao.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) return NextResponse.json({ error: "Tipo não encontrado" }, { status: 404 });

  const updated = await prisma.helpdeskTipoSolicitacao.update({
    where: { id },
    data: { status },
  });

  await logAudit({ userId, action: status === "A" ? "activate" : "inactivate", entity: "HelpdeskTipoSolicitacao", entityId: id, details: JSON.stringify({ clientId, status }) });

  return NextResponse.json({
    id: updated.id,
    nome: updated.nome,
    parent_id: updated.parentId,
    status: updated.status,
    ordem: updated.ordem,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  });
}
