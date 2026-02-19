import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser, getManagedGroupIdsForUser, getManagedSectorIdsForUser } from "@/lib/helpdesk";

export type ArvoreNode = {
  id: string;
  label: string;
  type: "group" | "sector" | "status";
  count?: number;
  children?: ArvoreNode[];
  ticketIds?: string[];
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  const clientIds = await getClientIdsForUser(userId);
  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  const managedGroupIds = await getManagedGroupIdsForUser(userId);
  const managedSectorIds = await getManagedSectorIdsForUser(userId);
  const isGestor = managedGroupIds.size > 0 || managedSectorIds.size > 0;
  if (!isAdmin && !isGestor) return NextResponse.json({ error: "Sem permissão para ver árvore" }, { status: 403 });

  const where: Record<string, unknown> = {};
  if (clientId) {
    if (!isAdmin && !clientIds.has(clientId)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    where.clientId = clientId;
  } else if (!isAdmin) {
    where.clientId = { in: Array.from(clientIds) };
  }
  if (!isAdmin && isGestor) {
    where.OR = [
      { assigneeType: "group", assigneeGroupId: { in: Array.from(managedGroupIds) } },
      { assigneeType: "sector", assigneeSectorId: { in: Array.from(managedSectorIds) } },
    ];
  }

  const tickets = await prisma.helpdeskTicket.findMany({
    where,
    select: {
      id: true,
      status: true,
      assigneeType: true,
      assigneeGroupId: true,
      assigneeSectorId: true,
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true, group: { select: { id: true, name: true } } } },
    },
  });

  const byGroup = new Map<string, { name: string; sectors: Map<string, { name: string; byStatus: Map<string, string[]> }> }>();
  for (const t of tickets) {
    const gId = t.assigneeGroupId ?? t.sector?.group?.id;
    const gName = t.group?.name ?? t.sector?.group?.name ?? "Sem setor";
    if (!gId) continue;
    if (!byGroup.has(gId)) {
      byGroup.set(gId, { name: gName, sectors: new Map() });
    }
    const g = byGroup.get(gId)!;
    const sId = t.assigneeType === "sector" && t.assigneeSectorId ? t.assigneeSectorId : "__group__";
    const sName = t.assigneeType === "sector" && t.sector ? t.sector.name : gName;
    if (!g.sectors.has(sId)) g.sectors.set(sId, { name: sName, byStatus: new Map() });
    const s = g.sectors.get(sId)!;
    const st = t.status;
    if (!s.byStatus.has(st)) s.byStatus.set(st, []);
    s.byStatus.get(st)!.push(t.id);
  }

  const tree: ArvoreNode[] = [];
  for (const [gId, g] of byGroup) {
    const groupCount = Array.from(g.sectors.values()).reduce((acc, s) => acc + Array.from(s.byStatus.values()).reduce((a, ids) => a + ids.length, 0), 0);
    const children: ArvoreNode[] = [];
    for (const [sId, s] of g.sectors) {
      const statusNodes: ArvoreNode[] = [];
      let sectorCount = 0;
      for (const [status, ids] of s.byStatus) {
        sectorCount += ids.length;
        statusNodes.push({ id: `${sId}-${status}`, label: status, type: "status", count: ids.length, ticketIds: ids });
      }
      children.push({
        id: sId,
        label: s.name,
        type: "sector",
        count: sectorCount,
        children: statusNodes,
      });
    }
    tree.push({ id: gId, label: g.name, type: "group", count: groupCount, children });
  }

  return NextResponse.json(tree);
}
