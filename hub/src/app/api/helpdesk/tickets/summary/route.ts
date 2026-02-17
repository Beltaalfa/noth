import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser, getGroupIdsForUser, getSectorIdsForUser } from "@/lib/helpdesk";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  const clientIds = await getClientIdsForUser(userId);
  if (clientId && !isAdmin && !clientIds.has(clientId)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  else if (!isAdmin) where.clientId = { in: Array.from(clientIds) };

  if (!isAdmin) {
    const groupIds = await getGroupIdsForUser(userId);
    const sectorIds = await getSectorIdsForUser(userId);
    where.OR = [
      { createdById: userId },
      { assigneeType: "user", assigneeUserId: userId },
      { assigneeType: "group", assigneeGroupId: { in: Array.from(groupIds) } },
      { assigneeType: "sector", assigneeSectorId: { in: Array.from(sectorIds) } },
    ];
  }

  const [abertos, emAndamento, aguardandoAprovacao, reprovados, encerrados] = await Promise.all([
    prisma.helpdeskTicket.count({ where: { ...where, status: "open" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "in_progress" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "pending_approval" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "rejected" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "closed" } }),
  ]);

  return NextResponse.json({
    abertos,
    emAndamento,
    aguardandoAprovacao,
    reprovados,
    encerrados,
  });
}
