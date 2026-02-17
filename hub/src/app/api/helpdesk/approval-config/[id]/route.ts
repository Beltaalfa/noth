import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await context.params;
  let body: { exigeAprovacao?: boolean; tipoAprovacao?: "hierarchical" | "by_level"; approvers?: { userId: string; ordem?: number; nivel?: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const config = await prisma.helpdeskApprovalConfig.findUnique({ where: { id } });
  if (!config) return NextResponse.json({ error: "Configuração não encontrada" }, { status: 404 });
  const updateData: { exigeAprovacao?: boolean; tipoAprovacao?: "hierarchical" | "by_level" } = {};
  if (typeof body.exigeAprovacao === "boolean") updateData.exigeAprovacao = body.exigeAprovacao;
  if (body.tipoAprovacao && ["hierarchical", "by_level"].includes(body.tipoAprovacao)) updateData.tipoAprovacao = body.tipoAprovacao;
  if (body.approvers !== undefined) {
    await prisma.helpdeskApprovalConfigApprover.deleteMany({ where: { configId: id } });
    if (Array.isArray(body.approvers) && body.approvers.length > 0) {
      await prisma.helpdeskApprovalConfigApprover.createMany({
        data: body.approvers.map((a) => ({ configId: id, userId: a.userId, ordem: a.ordem ?? null, nivel: a.nivel ?? null })),
      });
    }
  }
  const updated = await prisma.helpdeskApprovalConfig.update({
    where: { id },
    data: updateData,
    include: { group: { select: { id: true, name: true } }, sector: { select: { id: true, name: true } }, approvers: { include: { user: { select: { id: true, name: true } } } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await context.params;
  await prisma.helpdeskApprovalConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
