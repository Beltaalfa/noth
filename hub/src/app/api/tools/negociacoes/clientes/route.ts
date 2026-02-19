import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientIdsForNegociacoes } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const clientIds = await getClientIdsForNegociacoes(userId, isAdmin);
  if (clientIds.length === 0) return NextResponse.json([]);

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, deletedAt: null, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(clients.map((c) => ({ id: c.id, name: c.name })));
}
