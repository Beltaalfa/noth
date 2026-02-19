import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; proprietarioId: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id: clientId, proprietarioId } = await params;

  const row = await prisma.clientProprietario.findFirst({
    where: { id: proprietarioId, clientId },
    include: { client: { select: { name: true } } },
  });
  if (!row) return NextResponse.json({ error: "Proprietário não encontrado" }, { status: 404 });

  await prisma.clientProprietario.delete({ where: { id: proprietarioId } });
  await logAudit({
    userId: (session.user as { id?: string })?.id,
    action: "delete",
    entity: "ClientProprietario",
    entityId: proprietarioId,
    details: JSON.stringify({ clientId, clientName: row.client.name, userId: row.userId }),
  });
  return NextResponse.json({ ok: true });
}
