import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["report", "powerbi_report", "integration", "query_runner", "app"]),
  powerbiUrl: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  dbConnectionId: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const limit = searchParams.get("limit");
  const type = searchParams.get("type");

  const where = type ? { type: type as "powerbi_report", client: { deletedAt: null } } : { client: { deletedAt: null } };

  if (page && limit) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit)) || 25);
    const skip = (p - 1) * l;
    const [data, total] = await Promise.all([
      prisma.tool.findMany({
        where,
        include: { client: { select: { name: true } } },
        orderBy: { name: "asc" },
        skip,
        take: l,
      }),
      prisma.tool.count({ where }),
    ]);
    return NextResponse.json({ data, total });
  }

  const tools = await prisma.tool.findMany({
    where,
    include: { client: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(tools);
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
  const data = parsed.data as Record<string, unknown>;
  if (!data.powerbiUrl) delete data.powerbiUrl;
  if (!data.dbConnectionId) data.dbConnectionId = null;
  const tool = await prisma.tool.create({
    data: {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      powerbiUrl: parsed.data.powerbiUrl ?? null,
      status: parsed.data.status,
      dbConnectionId: parsed.data.dbConnectionId ?? null,
    },
  });
  await logAudit({
    userId: (session.user as { id?: string })?.id,
    action: "create",
    entity: "Tool",
    entityId: tool.id,
    details: JSON.stringify({ name: tool.name }),
  });
  return NextResponse.json(tool);
}
