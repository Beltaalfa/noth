import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().min(1),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const page = searchParams.get("page");
  const limit = searchParams.get("limit");
  const where = clientId ? { clientId } : undefined;

  if (page && limit) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit)) || 25);
    const skip = (p - 1) * l;
    const [data, total] = await Promise.all([
      prisma.group.findMany({ where, orderBy: { name: "asc" }, skip, take: l, include: { client: { select: { name: true } } } }),
      prisma.group.count({ where: where ?? {} }),
    ]);
    return NextResponse.json({ data, total });
  }

  const grupos = await prisma.group.findMany({
    where,
    orderBy: { name: "asc" },
    include: { client: { select: { name: true } } },
  });
  return NextResponse.json(grupos);
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

  const grupo = await prisma.group.create({
    data: parsed.data,
    include: { client: { select: { name: true } } },
  });
  return NextResponse.json(grupo);
}
