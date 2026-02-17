import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserAccessTicket } from "@/lib/helpdesk";

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

  let body: { status?: string; subject?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const canAccess = await canUserAccessTicket(userId, id);
  if (!canAccess) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const ticket = await prisma.helpdeskTicket.findUnique({ where: { id }, select: { status: true, createdById: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

  const updateData: { status?: "open" | "in_progress" | "closed"; subject?: string | null } = {};
  if (body.status && ["open", "in_progress", "closed"].includes(body.status)) {
    updateData.status = body.status as "open" | "in_progress" | "closed";
  }
  if (body.subject !== undefined) updateData.subject = body.subject?.trim() || null;

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
      messages: {
        include: { user: { select: { id: true, name: true } }, attachments: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return NextResponse.json(result);
}
