import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  const configsWhereUserIdIsApprover = await prisma.helpdeskApprovalConfigApprover.findMany({
    where: { userId },
    select: { config: { select: { groupId: true, sectorId: true } } },
  });
  const groupIds = configsWhereUserIdIsApprover.filter((c) => c.config.groupId).map((c) => c.config.groupId as string);
  const sectorIds = configsWhereUserIdIsApprover.filter((c) => c.config.sectorId).map((c) => c.config.sectorId as string);
  const orConditions = [
    ...(groupIds.length ? [{ assigneeType: "group" as const, assigneeGroupId: { in: groupIds } }] : []),
    ...(sectorIds.length ? [{ assigneeType: "sector" as const, assigneeSectorId: { in: sectorIds } }] : []),
  ];
  if (orConditions.length === 0) return NextResponse.json([]);
  const where: Record<string, unknown> = { status: "pending_approval", OR: orConditions };
  if (clientId) where.clientId = clientId;
  const tickets = await prisma.helpdeskTicket.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(tickets);
}
