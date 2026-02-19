import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
  relatoriosEnabled: z.boolean().optional(),
  ajusteDespesaEnabled: z.boolean().optional(),
  negociacoesEnabled: z.boolean().optional(),
  helpdeskEnabled: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
  });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const cliente = await prisma.client.update({
    where: { id },
    data: parsed.data,
  });
  await logAudit({
    userId: (session.user as { id?: string })?.id,
    action: "update",
    entity: "Client",
    entityId: id,
    details: JSON.stringify({ name: cliente.name }),
  });
  return NextResponse.json(cliente);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.client.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await logAudit({
    userId: (session.user as { id?: string })?.id,
    action: "delete",
    entity: "Client",
    entityId: id,
    details: "soft_delete",
  });
  return NextResponse.json({ ok: true });
}
