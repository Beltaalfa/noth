import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });

  const configs = await prisma.helpdeskApprovalConfig.findMany({
    where: { clientId },
    include: {
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      approvers: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  let body: {
    clientId: string;
    groupId?: string;
    sectorId?: string;
    exigeAprovacao: boolean;
    tipoAprovacao: "hierarchical" | "by_level";
    approvers?: { userId: string; ordem?: number; nivel?: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { clientId, groupId, sectorId, exigeAprovacao, tipoAprovacao, approvers = [] } = body;
  if (!clientId || typeof exigeAprovacao !== "boolean") {
    return NextResponse.json({ error: "clientId e exigeAprovacao obrigatórios" }, { status: 400 });
  }
  const hasGroup = !!groupId;
  const hasSector = !!sectorId;
  if (hasGroup === hasSector) {
    return NextResponse.json({ error: "Informe groupId OU sectorId, não ambos" }, { status: 400 });
  }
  if (!["hierarchical", "by_level"].includes(tipoAprovacao ?? "")) {
    return NextResponse.json({ error: "tipoAprovacao deve ser hierarchical ou by_level" }, { status: 400 });
  }

  const existing = await prisma.helpdeskApprovalConfig.findFirst({
    where: { clientId, ...(groupId ? { groupId } : { sectorId }) },
  });
  if (existing) {
    return NextResponse.json({ error: "Já existe configuração para este grupo/setor" }, { status: 409 });
  }

  const config = await prisma.helpdeskApprovalConfig.create({
    data: {
      clientId,
      groupId: groupId || null,
      sectorId: sectorId || null,
      exigeAprovacao,
      tipoAprovacao: tipoAprovacao as "hierarchical" | "by_level",
      approvers: {
        create: approvers.map((a) => ({
          userId: a.userId,
          ordem: a.ordem ?? null,
          nivel: a.nivel ?? null,
        })),
      },
    },
    include: {
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      approvers: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  return NextResponse.json(config);
}
