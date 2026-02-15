import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(["postgres", "firebird"]),
  host: z.string().min(1),
  port: z.number().min(1).max(65535),
  user: z.string().min(1),
  password: z.string(),
  database: z.string().min(1),
  extraParams: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
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

  const where = clientId ? { clientId } : {};

  if (page && limit) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit)) || 25);
    const skip = (p - 1) * l;
    const [data, total] = await Promise.all([
      prisma.dbConnection.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: l,
        include: { client: { select: { name: true } } },
      }),
      prisma.dbConnection.count({ where }),
    ]);
    return NextResponse.json({ data, total });
  }

  const conexoes = await prisma.dbConnection.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } } },
  });
  return NextResponse.json(conexoes);
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
  const conexao = await prisma.dbConnection.create({
    data: parsed.data,
    include: { client: { select: { name: true } } },
  });
  return NextResponse.json(conexao);
}
