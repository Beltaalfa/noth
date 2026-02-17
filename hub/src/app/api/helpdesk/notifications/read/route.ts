import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  let body: { ticketId?: string; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.all && !body.ticketId) {
    return NextResponse.json({ error: "Informe ticketId ou all: true" }, { status: 400 });
  }

  const where = body.all ? { userId } : { userId, ticketId: body.ticketId! };
  await prisma.helpdeskNotification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
