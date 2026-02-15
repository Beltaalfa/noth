import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const [userClient, userGroup, userSector, clientTools] = await Promise.all([
    prisma.userClientPermission.findMany({ include: { user: { select: { name: true, email: true } }, client: { select: { name: true } } } }),
    prisma.userGroupPermission.findMany({ include: { user: { select: { name: true, email: true } }, group: { include: { client: { select: { name: true } } } } } }),
    prisma.userSectorPermission.findMany({ include: { user: { select: { name: true, email: true } }, sector: { include: { group: { select: { name: true } } } } } }),
    prisma.clientTool.findMany({ include: { client: { select: { name: true } }, tool: { select: { name: true, slug: true } } } }),
  ]);
  return NextResponse.json({ userClient, userGroup, userSector, clientTools });
}

const addUserClientSchema = z.object({ userId: z.string(), clientId: z.string() });
const addUserGroupSchema = z.object({ userId: z.string(), groupId: z.string() });
const addUserSectorSchema = z.object({ userId: z.string(), sectorId: z.string() });
const addClientToolSchema = z.object({ clientId: z.string(), toolId: z.string() });

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await request.json();
  const { action } = body;

  if (action === "userClient") {
    const p = addUserClientSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    await prisma.userClientPermission.create({ data: p.data });
  } else if (action === "userGroup") {
    const p = addUserGroupSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    await prisma.userGroupPermission.create({ data: p.data });
  } else if (action === "userSector") {
    const p = addUserSectorSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    await prisma.userSectorPermission.create({ data: p.data });
  } else if (action === "clientTool") {
    const p = addClientToolSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    await prisma.clientTool.create({ data: p.data });
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
