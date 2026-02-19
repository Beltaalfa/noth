import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getClientIdsForUser,
  getGroupIdsForUser,
  getSectorIdsForUser,
  getManagedGroupIdsForUser,
  getManagedSectorIdsForUser,
} from "@/lib/helpdesk";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const view = searchParams.get("view");
  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  const clientIds = await getClientIdsForUser(userId);
  if (clientId && !isAdmin && !clientIds.has(clientId)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  else if (!isAdmin) where.clientId = { in: Array.from(clientIds) };

  if (view === "meus_chamados") {
    where.createdById = userId;
  } else if (view === "areas_geridas") {
    const managedGroupIds = await getManagedGroupIdsForUser(userId);
    const managedSectorIds = await getManagedSectorIdsForUser(userId);
    if (managedGroupIds.size === 0 && managedSectorIds.size === 0) {
      return NextResponse.json({
        abertos: 0,
        emAndamento: 0,
        aguardandoAprovacao: 0,
        reprovados: 0,
        encerrados: 0,
        agendado: 0,
        aguardandoAtendimento: 0,
        emAtendimento: 0,
        aguardandoFeedback: 0,
        concluido: 0,
        custoAguardandoAprovacao: 0,
      });
    }
    where.OR = [
      { assigneeType: "group", assigneeGroupId: { in: Array.from(managedGroupIds) } },
      { assigneeType: "sector", assigneeSectorId: { in: Array.from(managedSectorIds) } },
    ];
  } else if (!isAdmin) {
    const groupIds = await getGroupIdsForUser(userId);
    const sectorIds = await getSectorIdsForUser(userId);
    where.OR = [
      { createdById: userId },
      { assigneeType: "user", assigneeUserId: userId },
      { assigneeType: "group", assigneeGroupId: { in: Array.from(groupIds) } },
      { assigneeType: "sector", assigneeSectorId: { in: Array.from(sectorIds) } },
    ];
  }

  const [
    abertos,
    emAndamento,
    aguardandoAprovacao,
    reprovados,
    encerrados,
    agendado,
    aguardandoAtendimento,
    emAtendimento,
    aguardandoFeedback,
    concluido,
    custoAguardandoAprovacao,
  ] = await Promise.all([
    prisma.helpdeskTicket.count({ where: { ...where, status: { in: ["open", "aguardando_atendimento"] } } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: { in: ["in_progress", "em_atendimento", "encaminhado_operador", "agendado_com_usuario"] } } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "pending_approval" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "rejected" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: { in: ["closed", "concluido"] } } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "agendado_com_usuario" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "aguardando_atendimento" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "em_atendimento" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "aguardando_feedback_usuario" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "concluido" } }),
    prisma.helpdeskTicket.count({ where: { ...where, status: "custo_aguardando_aprovacao" } }),
  ]);

  return NextResponse.json({
    abertos,
    emAndamento,
    aguardandoAprovacao,
    reprovados,
    encerrados,
    agendado,
    aguardandoAtendimento,
    emAtendimento,
    aguardandoFeedback,
    concluido,
    custoAguardandoAprovacao,
  });
}
