import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserApproveTicket } from "@/lib/helpdesk";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id } = await context.params;

  let body: { comment: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!body.comment?.trim()) return NextResponse.json({ error: "Comentário obrigatório ao reprovar" }, { status: 400 });

  const canApprove = await canUserApproveTicket(userId, id);
  if (!canApprove) return NextResponse.json({ error: "Sem permissão para reprovar" }, { status: 403 });

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id },
    select: { status: true, createdById: true },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (ticket.status !== "pending_approval") {
    return NextResponse.json({ error: "Ticket não está aguardando aprovação" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.helpdeskApprovalLog.create({
      data: { ticketId: id, userId, action: "rejected", comment: body.comment.trim() },
    }),
    prisma.helpdeskTicket.update({ where: { id }, data: { status: "rejected" } }),
  ]);

  if (ticket.createdById !== userId) {
    await prisma.helpdeskNotification.create({
      data: { userId: ticket.createdById, ticketId: id, type: "returned_for_revision" },
    });
  }

  const updated = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(updated);
}
