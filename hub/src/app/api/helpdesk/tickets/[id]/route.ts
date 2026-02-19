import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpdeskTicketStatus, HelpdeskTicketPriority } from "@prisma/client";
import {
  canUserAccessTicket,
  getHelpdeskProfile,
  getManagedGroupIdsForUser,
  getManagedSectorIdsForUser,
} from "@/lib/helpdesk";
import { patchTicketBodySchema } from "@/lib/schemas/helpdesk";

const VALID_STATUSES: HelpdeskTicketStatus[] = [
  "open", "in_progress", "closed", "pending_approval", "in_approval", "rejected", "approved", "cancelled",
  "agendado_com_usuario", "aguardando_atendimento", "em_atendimento", "aguardando_feedback_usuario",
  "encaminhado_operador", "indisponivel_atendimento", "reaberto", "retornado_usuario",
  "custo_aguardando_aprovacao", "autorizado", "negado", "atualizado", "concluido",
];
const VALID_PRIORITIES: HelpdeskTicketPriority[] = ["baixa", "media", "alta", "critica"];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id } = await context.params;
  const canAccess = await canUserAccessTicket(userId, id);
  if (!canAccess) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      assigneeUser: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      tipoSolicitacao: { select: { id: true, nome: true } },
      auxAssignees: { include: { user: { select: { id: true, name: true } } } },
      messages: {
        include: {
          user: { select: { id: true, name: true } },
          attachments: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const parsed = patchTicketBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join("; ") || "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const body = parsed.data;

  const canAccess = await canUserAccessTicket(userId, id);
  if (!canAccess) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id },
    select: {
      status: true,
      createdById: true,
      custoOrcamento: true,
      assigneeType: true,
      assigneeGroupId: true,
      assigneeSectorId: true,
    },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

  if (body.status && body.status !== ticket.status) {
    const newStatus = body.status as HelpdeskTicketStatus;
    if (newStatus === "autorizado" || newStatus === "negado") {
      if (ticket.status !== "custo_aguardando_aprovacao") {
        return NextResponse.json({ error: "Só é possível autorizar/negado quando o chamado está com custo aguardando aprovação" }, { status: 400 });
      }
      if (!isAdmin) {
        const profile = await getHelpdeskProfile(userId);
        const managedGroupIds = await getManagedGroupIdsForUser(userId);
        const managedSectorIds = await getManagedSectorIdsForUser(userId);
        const inArea =
          (ticket.assigneeType === "group" && ticket.assigneeGroupId && managedGroupIds.has(ticket.assigneeGroupId)) ||
          (ticket.assigneeType === "sector" && ticket.assigneeSectorId && managedSectorIds.has(ticket.assigneeSectorId));
        if (!profile?.isGerenteArea || !inArea) {
          return NextResponse.json({ error: "Apenas gestor da área pode autorizar ou negar custo" }, { status: 403 });
        }
        const custo = ticket.custoOrcamento != null ? Number(ticket.custoOrcamento) : 0;
        const maxAuth = profile.valorMaximoAutorizar != null ? Number(profile.valorMaximoAutorizar) : 0;
        if (custo > maxAuth) {
          return NextResponse.json({ error: "Valor do orçamento excede o valor máximo que você pode autorizar" }, { status: 403 });
        }
      }
    } else if (newStatus === "reaberto") {
      if (!["concluido", "closed"].includes(ticket.status)) {
        return NextResponse.json({ error: "Só é possível reabrir chamados concluídos" }, { status: 400 });
      }
      if (!isAdmin && ticket.createdById !== userId) {
        return NextResponse.json({ error: "Apenas o solicitante pode reabrir o chamado" }, { status: 403 });
      }
    }
  }

  const updateData: {
    status?: HelpdeskTicketStatus;
    priority?: HelpdeskTicketPriority | null;
    subject?: string | null;
    assigneeUserId?: string | null;
    scheduledAt?: Date | null;
  } = {};
  if (body.status && VALID_STATUSES.includes(body.status as HelpdeskTicketStatus)) {
    updateData.status = body.status as HelpdeskTicketStatus;
  }
  if (body.priority !== undefined) {
    updateData.priority = VALID_PRIORITIES.includes(body.priority as HelpdeskTicketPriority)
      ? (body.priority as HelpdeskTicketPriority)
      : null;
  }
  if (body.subject !== undefined) updateData.subject = body.subject?.trim() || null;
  if (body.assigneeUserId !== undefined) updateData.assigneeUserId = body.assigneeUserId || null;
  if (body.scheduledAt !== undefined) updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

  if (body.content?.trim() && ticket.createdById === userId && ticket.status === "rejected") {
    await prisma.helpdeskMessage.create({
      data: { ticketId: id, userId, content: body.content.trim() },
    });
  }

  const willAddMessage = !!(body.content?.trim() && ticket.createdById === userId && ticket.status === "rejected");
  if (Object.keys(updateData).length === 0 && !willAddMessage) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.helpdeskTicket.update({ where: { id }, data: updateData });
  }

  const result = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
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
  return NextResponse.json(result);
}
