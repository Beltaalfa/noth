import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  groupId: z.string().min(1),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const setores = await prisma.sector.findMany({
    where: groupId ? { groupId } : undefined,
    orderBy: { name: "asc" },
    include: { group: { include: { client: { select: { name: true } } } } },
  });
  return NextResponse.json(setores);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const setor = await prisma.sector.create({
    data: parsed.data,
    include: { group: { include: { client: { select: { name: true } } } } },
  });
  return NextResponse.json(setor);
}
