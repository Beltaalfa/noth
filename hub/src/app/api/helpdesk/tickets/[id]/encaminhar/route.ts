import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserAccessTicket, getHelpdeskProfile, userHasAccessToClient } from "@/lib/helpdesk";
import { encaminharBodySchema } from "@/lib/schemas/helpdesk";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  const profile = await getHelpdeskProfile(userId);
  if (!isAdmin && !profile?.podeEncaminharChamados) {
    return NextResponse.json({ error: "Sem permissão para encaminhar chamados" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const parsed = encaminharBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join("; ") || "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { novoResponsavelUserId, operadoresAuxiliaresIds = [], scheduledAt, comentario } = parsed.data;

  const canAccess = await canUserAccessTicket(userId, id);
  if (!canAccess) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: {
      group: true,
      sector: { include: { group: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

  const newUser = await prisma.user.findUnique({
    where: { id: novoResponsavelUserId },
    select: { id: true, podeReceberChamados: true, primaryGroupId: true, primarySectorId: true, primaryGroup: true, primarySector: { include: { group: true } } },
  });
  if (!newUser) return NextResponse.json({ error: "Responsável não encontrado" }, { status: 400 });
  if (!newUser.podeReceberChamados) {
    return NextResponse.json({ error: "O responsável selecionado não pode receber chamados" }, { status: 400 });
  }

  const newUserHasAccessToClient = await userHasAccessToClient(novoResponsavelUserId, ticket.clientId);
  if (!newUserHasAccessToClient && !isAdmin) {
    return NextResponse.json({ error: "O responsável deve ter acesso ao cliente do chamado" }, { status: 400 });
  }

  const assigneeGroupId = newUser?.primaryGroupId ?? ticket.assigneeGroupId;
  const assigneeSectorId = newUser?.primarySectorId ?? ticket.assigneeSectorId;

  await prisma.$transaction([
    prisma.helpdeskTicketAuxAssignee.deleteMany({ where: { ticketId: id } }),
    prisma.helpdeskTicket.update({
      where: { id },
      data: {
        assigneeType: "user",
        assigneeUserId: novoResponsavelUserId,
        assigneeGroupId,
        assigneeSectorId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? "agendado_com_usuario" : "encaminhado_operador",
      },
    }),
  ]);

  if (operadoresAuxiliaresIds?.length) {
    await prisma.helpdeskTicketAuxAssignee.createMany({
      data: operadoresAuxiliaresIds.filter((uid) => uid !== novoResponsavelUserId).map((uid) => ({ ticketId: id, userId: uid })),
      skipDuplicates: true,
    });
  }

  if (comentario?.trim()) {
    await prisma.helpdeskMessage.create({
      data: {
        ticketId: id,
        userId,
        content: `[Encaminhamento] ${comentario.trim()}`,
      },
    });
  }

  const userIdsToNotify = new Set<string>([novoResponsavelUserId, ...(operadoresAuxiliaresIds ?? [])]);
  userIdsToNotify.delete(userId);
  if (userIdsToNotify.size > 0) {
    await prisma.helpdeskNotification.createMany({
      data: Array.from(userIdsToNotify).map((uid) => ({
        userId: uid,
        ticketId: id,
        type: "new_ticket",
      })),
    });
  }

  const updated = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      assigneeUser: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      tipoSolicitacao: { select: { id: true, nome: true } },
      auxAssignees: { include: { user: { select: { id: true, name: true } } } },
      messages: {
        include: { user: { select: { id: true, name: true } }, attachments: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return NextResponse.json(updated);
}
