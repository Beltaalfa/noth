import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const postSchema = z.object({ userId: z.string().min(1) });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id: clientId } = await params;
  const client = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const [proprietarios, usersWithAccess] = await Promise.all([
    prisma.clientProprietario.findMany({
      where: { clientId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        status: "active",
        OR: [
          { userClientPermissions: { some: { clientId } } },
          { userGroupPermissions: { some: { group: { clientId } } } },
          { userSectorPermissions: { some: { sector: { group: { clientId } } } } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    proprietarios: proprietarios.map((p) => ({
      id: p.id,
      userId: p.userId,
      createdAt: p.createdAt,
      user: p.user,
    })),
    availableUsers: usersWithAccess,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id: clientId } = await params;
  const client = await prisma.client.findFirst({
    where: { id: clientId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "userId é obrigatório", details: parsed.error.flatten() }, { status: 400 });
  }
  const { userId } = parsed.data;

  const existing = await prisma.clientProprietario.findUnique({
    where: { clientId_userId: { clientId, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Usuário já é proprietário deste cliente" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const created = await prisma.clientProprietario.create({
    data: { clientId, userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await logAudit({
    userId: (session.user as { id?: string })?.id,
    action: "create",
    entity: "ClientProprietario",
    entityId: created.id,
    details: JSON.stringify({ clientId, clientName: client.name, userId }),
  });
  return NextResponse.json(created);
}
