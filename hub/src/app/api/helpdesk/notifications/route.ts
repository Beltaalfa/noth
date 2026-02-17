import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const where: { userId: string; readAt?: null } = { userId };
  if (unreadOnly) (where as Record<string, unknown>).readAt = null;

  const notifications = await prisma.helpdeskNotification.findMany({
    where,
    include: {
      ticket: { select: { id: true, subject: true, status: true } },
      message: { select: { id: true, content: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.helpdeskNotification.count({
    where: { userId, readAt: null },
  });

  return NextResponse.json({ notifications, unreadCount });
}
