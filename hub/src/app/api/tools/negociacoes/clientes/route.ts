import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getToolsForUser } from "@/lib/permissions";
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

  const role = (session.user as { role?: string })?.role;
  if (role === "admin") {
    const clients = await prisma.client.findMany({
      where: { deletedAt: null, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(clients.map((c) => ({ id: c.id, name: c.name })));
  }

  const tools = await getToolsForUser(userId);
  const negociacoes = tools.filter((t) => t.slug === "negociacoes");
  const clientIds = [...new Set(negociacoes.map((t) => t.clientId))];
  if (clientIds.length === 0) return NextResponse.json([]);

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, deletedAt: null, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(clients.map((c) => ({ id: c.id, name: c.name })));
}
