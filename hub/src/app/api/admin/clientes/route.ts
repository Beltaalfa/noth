import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const clientes = await prisma.client.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(clientes);
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

  const cliente = await prisma.client.create({
    data: parsed.data,
  });
  await logAudit({
    userId: (session.user as { id?: string })?.id,
    action: "create",
    entity: "Client",
    entityId: cliente.id,
    details: JSON.stringify({ name: cliente.name }),
  });
  return NextResponse.json(cliente);
}
