import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({
  toolId: z.string(),
  principalType: z.enum(["user", "group", "sector"]),
  principalId: z.string(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get("toolId");
  if (!toolId) {
    return NextResponse.json({ error: "toolId obrigatório" }, { status: 400 });
  }
  const perms = await prisma.toolPermission.findMany({
    where: { toolId },
    include: {
      tool: { select: { name: true, slug: true } },
    },
  });
  return NextResponse.json(perms);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  await prisma.toolPermission.create({
    data: parsed.data,
  });
  return NextResponse.json({ ok: true });
}
