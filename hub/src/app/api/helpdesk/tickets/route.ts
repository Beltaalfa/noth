import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  getClientIdsForUser,
  getGroupIdsForUser,
  getSectorIdsForUser,
  canUserCreateTicketFor,
  getHelpdeskProfile,
  getManagedGroupIdsForUser,
  getManagedSectorIdsForUser,
  getQueueGroupIdsForUser,
  getQueueSectorIdsForUser,
} from "@/lib/helpdesk";
import {
  createTicketBodySchema,
  TIPO_CADASTRO_DESCONTO_COMERCIAL,
  formDataCadastroDescontoSchema,
} from "@/lib/schemas/helpdesk";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";

const includeList = {
  creator: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  assigneeUser: {
    select: {
      id: true,
      name: true,
      primaryGroup: { select: { id: true, name: true } },
      primarySector: { select: { id: true, name: true, group: { select: { name: true } } } },
    },
  },
  group: { select: { id: true, name: true } },
  sector: { select: { id: true, name: true } },
  tipoSolicitacao: { select: { id: true, nome: true } },
  _count: { select: { messages: true } },
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const view = searchParams.get("view"); // meus_chamados | filas | areas_geridas

  const clientIds = await getClientIdsForUser(userId);
  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  const where: Record<string, unknown> = {};
  if (clientId) {
    if (!isAdmin && !clientIds.has(clientId)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    where.clientId = clientId;
  } else if (!isAdmin) {
    where.clientId = { in: Array.from(clientIds) };
  }
  if (status) where.status = status;

  if (view === "meus_chamados") {
    where.createdById = userId;
  } else if (view === "filas") {
    const profile = await getHelpdeskProfile(userId);
    if (!profile?.podeReceberChamados) return NextResponse.json({ error: "Sem permissão para ver filas" }, { status: 403 });
    const queueGroupIds = await getQueueGroupIdsForUser(userId);
    const queueSectorIds = await getQueueSectorIdsForUser(userId);
    if (queueGroupIds.size === 0 && queueSectorIds.size === 0) return NextResponse.json([]);
    const filasOr: Record<string, unknown>[] = [
      { assigneeGroupId: { in: Array.from(queueGroupIds) }, status: { in: ["aguardando_atendimento", "open"] } },
      { assigneeSectorId: { in: Array.from(queueSectorIds) }, status: { in: ["aguardando_atendimento", "open"] } },
    ];
    if (queueGroupIds.size > 0) {
      filasOr.push({
        assigneeUserId: userId,
        assigneeGroupId: { in: Array.from(queueGroupIds) },
        status: { in: ["encaminhado_operador", "em_atendimento", "agendado_com_usuario"] },
      });
    }
    if (queueSectorIds.size > 0) {
      filasOr.push({
        assigneeUserId: userId,
        assigneeSectorId: { in: Array.from(queueSectorIds) },
        status: { in: ["encaminhado_operador", "em_atendimento", "agendado_com_usuario"] },
      });
    }
    where.OR = filasOr;
  } else if (view === "areas_geridas") {
    const managedGroupIds = await getManagedGroupIdsForUser(userId);
    const managedSectorIds = await getManagedSectorIdsForUser(userId);
    if (managedGroupIds.size === 0 && managedSectorIds.size === 0) return NextResponse.json([]);
    where.OR = [
      { assigneeType: "group", assigneeGroupId: { in: Array.from(managedGroupIds) } },
      { assigneeType: "sector", assigneeSectorId: { in: Array.from(managedSectorIds) } },
    ];
    const groupId = searchParams.get("groupId");
    const sectorId = searchParams.get("sectorId");
    if (groupId && managedGroupIds.has(groupId)) {
      where.assigneeType = "group";
      where.assigneeGroupId = groupId;
      delete where.OR;
    } else if (sectorId && managedSectorIds.has(sectorId)) {
      where.assigneeType = "sector";
      where.assigneeSectorId = sectorId;
      delete where.OR;
    }
  } else if (!isAdmin) {
    const [groupIds, sectorIds, approverConfigs, clientIdsProprietario] = await Promise.all([
      getGroupIdsForUser(userId),
      getSectorIdsForUser(userId),
      prisma.helpdeskApprovalConfigApprover.findMany({ where: { userId }, select: { config: { select: { groupId: true, sectorId: true } } } }),
      prisma.clientProprietario.findMany({ where: { userId }, select: { clientId: true } }),
    ]);
    const approverGroupIds = approverConfigs.filter((c) => c.config.groupId).map((c) => c.config.groupId!);
    const approverSectorIds = approverConfigs.filter((c) => c.config.sectorId).map((c) => c.config.sectorId!);
    const clientIdsProprietarioSet = clientIdsProprietario.map((p) => p.clientId);
    where.OR = [
      { createdById: userId },
      { assigneeType: "user", assigneeUserId: userId },
      { assigneeType: "group", assigneeGroupId: { in: Array.from(groupIds) } },
      { assigneeType: "sector", assigneeSectorId: { in: Array.from(sectorIds) } },
      ...(approverGroupIds.length ? [{ status: "pending_approval", assigneeType: "group", assigneeGroupId: { in: approverGroupIds } }] : []),
      ...(approverSectorIds.length ? [{ status: "pending_approval", assigneeType: "sector", assigneeSectorId: { in: approverSectorIds } }] : []),
      ...(clientIdsProprietarioSet.length > 0
        ? [{ status: "aguardando_aprovacao_proprietarios", clientId: { in: clientIdsProprietarioSet } }]
        : []),
    ];
  }

  const tickets = await prisma.helpdeskTicket.findMany({
    where,
    include: includeList,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });
  return NextResponse.json(tickets);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const rl = checkRateLimit(getRateLimitKey(userId, "ticket:create"));
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em alguns instantes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const parsed = createTicketBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join("; ") || "Dados inválidos";
    return NextResponse.json({ error: msg, details: parsed.error.flatten() }, { status: 400 });
  }
  const { clientId, subject, assigneeType, assigneeId, content, tipoSolicitacaoId, formData, custoOrcamento } = parsed.data;

  let workflowStep: string | null = null;
  let formDataToSave: Record<string, unknown> | null = null;
  let custoOrcamentoToSave: number | null = null;

  if (tipoSolicitacaoId) {
    const tipo = await prisma.helpdeskTipoSolicitacao.findUnique({
      where: { id: tipoSolicitacaoId },
      select: { nome: true },
    });
    if (tipo?.nome === TIPO_CADASTRO_DESCONTO_COMERCIAL) {
      workflowStep = "credito";
      const formParsed = formDataCadastroDescontoSchema.safeParse(formData ?? {});
      if (!formParsed.success) {
        const msg = formParsed.error.issues.map((e) => e.message).join("; ") || "formData inválido";
        return NextResponse.json({ error: msg, details: formParsed.error.flatten() }, { status: 400 });
      }
      if (custoOrcamento == null || Number.isNaN(custoOrcamento) || custoOrcamento < 0) {
        return NextResponse.json({ error: "Valor do desconto é obrigatório para este tipo de solicitação" }, { status: 400 });
      }
      formDataToSave = formParsed.data as unknown as Record<string, unknown>;
      custoOrcamentoToSave = Number(custoOrcamento);
    }
  }

  const canCreate = await canUserCreateTicketFor(userId, clientId, assigneeType, assigneeId);
  const role = (session.user as { role?: string })?.role;
  if (!canCreate && role !== "admin") {
    return NextResponse.json({ error: "Sem permissão para criar ticket" }, { status: 403 });
  }

  let initialStatus: "open" | "pending_approval" = "open";
  const approvalConfig =
    assigneeType === "group" || assigneeType === "sector"
      ? await prisma.helpdeskApprovalConfig.findFirst({
          where: {
            clientId,
            ...(assigneeType === "group" ? { groupId: assigneeId } : { sectorId: assigneeId }),
          },
          include: { approvers: { select: { userId: true } } },
        })
      : null;

  if (approvalConfig?.exigeAprovacao) {
    initialStatus = "pending_approval";
  }

  const maxNumero = await prisma.helpdeskTicket.aggregate({
    where: { clientId },
    _max: { numero: true },
  });
  const proximoNumero = (maxNumero._max.numero ?? 0) + 1;

  const priority = parsed.data.priority ?? null;

  const ticket = await prisma.helpdeskTicket.create({
    data: {
      clientId,
      numero: proximoNumero,
      subject: subject?.trim() || null,
      tipoSolicitacaoId: tipoSolicitacaoId || null,
      status: initialStatus,
      priority: priority as "baixa" | "media" | "alta" | "critica" | undefined,
      assigneeType,
      assigneeUserId: assigneeType === "user" ? assigneeId : null,
      assigneeGroupId: assigneeType === "group" ? assigneeId : null,
      assigneeSectorId: assigneeType === "sector" ? assigneeId : null,
      createdById: userId,
      workflowStep,
      formData: (formDataToSave ?? undefined) as Prisma.InputJsonValue | undefined,
      custoOrcamento: custoOrcamentoToSave ?? undefined,
      messages: {
        create: { userId, content: content.trim() },
      },
    },
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      messages: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  const firstMsg = ticket.messages[0];
  const userIdsToNotify = new Set<string>();

  if (initialStatus === "pending_approval" && approvalConfig) {
    approvalConfig.approvers.forEach((a) => userIdsToNotify.add(a.userId));
    userIdsToNotify.delete(userId);
    if (userIdsToNotify.size > 0) {
      await prisma.helpdeskNotification.createMany({
        data: Array.from(userIdsToNotify).map((uid) => ({
          userId: uid,
          ticketId: ticket.id,
          messageId: firstMsg?.id ?? null,
          type: "awaiting_approval",
        })),
      });
    }
  } else {
    if (assigneeType === "user" && assigneeId !== userId) userIdsToNotify.add(assigneeId);
    if (assigneeType === "group") {
      const perms = await prisma.userGroupPermission.findMany({
        where: { groupId: assigneeId },
        select: { userId: true },
      });
      perms.forEach((p) => userIdsToNotify.add(p.userId));
    }
    if (assigneeType === "sector") {
      const perms = await prisma.userSectorPermission.findMany({
        where: { sectorId: assigneeId },
        select: { userId: true },
      });
      perms.forEach((p) => userIdsToNotify.add(p.userId));
    }
    userIdsToNotify.delete(userId);
    if (userIdsToNotify.size > 0 && firstMsg) {
      await prisma.helpdeskNotification.createMany({
        data: Array.from(userIdsToNotify).map((uid) => ({
          userId: uid,
          ticketId: ticket.id,
          messageId: firstMsg.id,
          type: "new_ticket",
        })),
      });
    }
  }

  return NextResponse.json(ticket);
}
