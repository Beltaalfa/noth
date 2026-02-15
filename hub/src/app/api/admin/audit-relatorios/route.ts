import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const from = fromParam ? new Date(fromParam) : startOfMonth;
  const to = toParam ? new Date(toParam) : now;

  const logs = await prisma.auditLog.findMany({
    where: {
      action: "report_view",
      entity: "Tool",
      createdAt: { gte: from, lte: to },
      userId: { not: null },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const toolIds = [...new Set(logs.map((l) => l.entityId).filter(Boolean))] as string[];
  const tools = await prisma.tool.findMany({
    where: { id: { in: toolIds } },
    select: { id: true, name: true, slug: true },
  });
  const toolMap = Object.fromEntries(tools.map((t) => [t.id, t]));

  const totalRelatorios = toolIds.length;
  const acessosNoPeriodo = logs.length;
  const acessosNoDia = logs.filter((l) => new Date(l.createdAt) >= startOfDay).length;
  const acessosNaSemana = logs.filter((l) => new Date(l.createdAt) >= startOfWeek).length;
  const acessosNoMes = logs.filter((l) => new Date(l.createdAt) >= startOfMonth).length;

  const userCounts: Record<string, { count: number; name: string; email: string }> = {};
  for (const log of logs) {
    if (log.userId && log.user) {
      if (!userCounts[log.userId]) {
        userCounts[log.userId] = { count: 0, name: log.user.name, email: log.user.email };
      }
      userCounts[log.userId].count++;
    }
  }
  const usuariosMaisAcessam = Object.entries(userCounts)
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const reportCounts: Record<string, number> = {};
  for (const log of logs) {
    if (log.entityId) {
      reportCounts[log.entityId] = (reportCounts[log.entityId] || 0) + 1;
    }
  }
  const relatoriosMaisAcessados = Object.entries(reportCounts)
    .map(([toolId, count]) => ({
      toolId,
      toolName: toolMap[toolId]?.name ?? toolId,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const detalhes = logs.slice(0, 100).map((l) => ({
    userId: l.userId,
    userName: l.user?.name ?? "-",
    userEmail: l.user?.email ?? "-",
    toolId: l.entityId,
    toolName: l.entityId ? (toolMap[l.entityId]?.name ?? l.entityId) : "-",
    createdAt: l.createdAt,
  }));

  return NextResponse.json({
    resumo: {
      totalRelatorios,
      acessosNoPeriodo,
      acessosNoDia,
      acessosNaSemana,
      acessosNoMes,
    },
    usuariosMaisAcessam,
    relatoriosMaisAcessados,
    detalhes,
  });
}
