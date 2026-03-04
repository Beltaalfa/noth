import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getManagerUserIdsForSector } from "@/lib/helpdesk";

const STATUS_FINAL = ["closed", "concluido", "cancelled"] as const;

/** POST /api/helpdesk/sla-check — checa SLA e cria notificações (sla_breached / sla_near_breach). Admin ou header X-SLA-Check-Secret. */
export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const secret = request.headers.get("X-SLA-Check-Secret");
  const cronOk = process.env.HELPDESK_SLA_CHECK_SECRET && secret === process.env.HELPDESK_SLA_CHECK_SECRET;
  if (role !== "admin" && !cronOk) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = Date.now();
  const tickets = await prisma.helpdeskTicket.findMany({
    where: {
      slaLimitHours: { not: null },
      status: { notIn: [...STATUS_FINAL] },
    },
    select: {
      id: true,
      subject: true,
      createdAt: true,
      slaLimitHours: true,
      assigneeType: true,
      assigneeUserId: true,
      assigneeGroupId: true,
      assigneeSectorId: true,
      tipoSolicitacaoId: true,
    },
  });

  let breached = 0;
  let nearBreach = 0;

  for (const ticket of tickets) {
    const slaLimitHours = ticket.slaLimitHours!;
    const limiteMs = ticket.createdAt.getTime() + slaLimitHours * 60 * 60 * 1000;

    // Tipo para warnHours (default 1)
    let warnHours = 1;
    if (ticket.tipoSolicitacaoId) {
      const tipo = await prisma.helpdeskTipoSolicitacao.findUnique({
        where: { id: ticket.tipoSolicitacaoId },
        select: { slaWarnHoursBefore: true },
      });
      if (tipo?.slaWarnHoursBefore != null) warnHours = tipo.slaWarnHoursBefore;
    }
    const warnWindowMs = warnHours * 60 * 60 * 1000;

    // SLA estourado: notificar gestores
    if (now > limiteMs) {
      const exists = await prisma.helpdeskNotification.findFirst({
        where: { ticketId: ticket.id, type: "sla_breached" },
      });
      if (!exists) {
        const managerIds = new Set<string>();
        if (ticket.assigneeSectorId) {
          const ids = await getManagerUserIdsForSector(ticket.assigneeSectorId);
          ids.forEach((id) => managerIds.add(id));
        }
        if (ticket.assigneeGroupId) {
          const sectors = await prisma.sector.findMany({
            where: { groupId: ticket.assigneeGroupId },
            select: { id: true },
          });
          for (const s of sectors) {
            const ids = await getManagerUserIdsForSector(s.id);
            ids.forEach((id) => managerIds.add(id));
          }
        }
        if (managerIds.size > 0) {
          await prisma.helpdeskNotification.createMany({
            data: Array.from(managerIds).map((userId) => ({
              userId,
              ticketId: ticket.id,
              messageId: null,
              type: "sla_breached",
            })),
          });
          breached++;
        }
      }
      continue;
    }

    // Próximo do limite: notificar atendentes
    if (now >= limiteMs - warnWindowMs && now < limiteMs) {
      const exists = await prisma.helpdeskNotification.findFirst({
        where: { ticketId: ticket.id, type: "sla_near_breach" },
      });
      if (!exists) {
        const assigneeIds = new Set<string>();
        if (ticket.assigneeUserId) assigneeIds.add(ticket.assigneeUserId);
        if (ticket.assigneeGroupId) {
          const perms = await prisma.userGroupPermission.findMany({
            where: { groupId: ticket.assigneeGroupId },
            select: { userId: true },
          });
          perms.forEach((p) => assigneeIds.add(p.userId));
        }
        if (ticket.assigneeSectorId) {
          const perms = await prisma.userSectorPermission.findMany({
            where: { sectorId: ticket.assigneeSectorId },
            select: { userId: true },
          });
          perms.forEach((p) => assigneeIds.add(p.userId));
        }
        if (assigneeIds.size > 0) {
          await prisma.helpdeskNotification.createMany({
            data: Array.from(assigneeIds).map((userId) => ({
              userId,
              ticketId: ticket.id,
              messageId: null,
              type: "sla_near_breach",
            })),
          });
          nearBreach++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, breached, nearBreach, checked: tickets.length });
}
