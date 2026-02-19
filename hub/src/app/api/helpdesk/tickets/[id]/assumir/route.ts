import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHelpdeskProfile, getQueueGroupIdsForUser, getQueueSectorIdsForUser } from "@/lib/helpdesk";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id } = await context.params;

  const profile = await getHelpdeskProfile(userId);
  if (!profile?.podeReceberChamados) {
    return NextResponse.json({ error: "Sem permissão para assumir chamados" }, { status: 403 });
  }

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id },
    select: {
      status: true,
      assigneeType: true,
      assigneeGroupId: true,
      assigneeSectorId: true,
    },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

  const queueGroupIds = await getQueueGroupIdsForUser(userId);
  const queueSectorIds = await getQueueSectorIdsForUser(userId);
  const inQueue =
    (ticket.assigneeType === "group" && ticket.assigneeGroupId && queueGroupIds.has(ticket.assigneeGroupId)) ||
    (ticket.assigneeType === "sector" && ticket.assigneeSectorId && queueSectorIds.has(ticket.assigneeSectorId));
  if (!inQueue) return NextResponse.json({ error: "Chamado não está na sua fila" }, { status: 403 });

  const statusQueue = ["aguardando_atendimento", "open"];
  if (!statusQueue.includes(ticket.status)) {
    return NextResponse.json({ error: "Chamado não está aguardando atendimento" }, { status: 400 });
  }

  await prisma.helpdeskTicket.update({
    where: { id },
    data: {
      assigneeUserId: userId,
      status: "em_atendimento",
    },
  });

  const updated = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      assigneeUser: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      tipoSolicitacao: { select: { id: true, nome: true } },
      _count: { select: { messages: true } },
    },
  });
  return NextResponse.json(updated);
}
