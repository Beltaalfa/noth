import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser } from "@/lib/helpdesk";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }

  const clientIds = await getClientIdsForUser(userId);
  const role = (session.user as { role?: string })?.role;
  if (!clientIds.has(clientId) && role !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const isAdmin = role === "admin";
  const onlyReceivers = searchParams.get("onlyReceivers") === "true";

  const userWhere: Prisma.UserWhereInput = isAdmin
    ? { deletedAt: null, status: "active" }
    : {
        deletedAt: null,
        status: "active",
        OR: [
          { userClientPermissions: { some: { clientId } } },
          { userGroupPermissions: { some: { group: { clientId } } } },
          { userSectorPermissions: { some: { sector: { group: { clientId } } } } },
        ],
      };
  if (onlyReceivers) {
    userWhere.podeReceberChamados = true;
  }

  const [users, groups, sectors, userGroupPerms, userSectorPerms] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        primaryGroupId: true,
        primarySectorId: true,
        primaryGroup: { select: { id: true, name: true, clientId: true } },
        primarySector: { select: { id: true, name: true, group: { select: { name: true, clientId: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({
      where: { clientId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.sector.findMany({
      where: { group: { clientId } },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.userGroupPermission.findMany({
      where: { group: { clientId } },
      select: { userId: true, groupId: true },
    }),
    prisma.userSectorPermission.findMany({
      where: { sector: { group: { clientId } } },
      select: { userId: true, sectorId: true },
    }),
  ]);

  const groupIdsByUser = new Map<string, Set<string>>();
  const sectorIdsByUser = new Map<string, Set<string>>();
  for (const u of users) {
    const gIds = new Set<string>();
    const sIds = new Set<string>();
    for (const p of userGroupPerms) {
      if (p.userId === u.id) gIds.add(p.groupId);
    }
    for (const p of userSectorPerms) {
      if (p.userId === u.id) sIds.add(p.sectorId);
    }
    if (u.primaryGroupId && u.primaryGroup?.clientId === clientId) gIds.add(u.primaryGroupId);
    if (u.primarySectorId && u.primarySector?.group?.clientId === clientId) sIds.add(u.primarySectorId);
    groupIdsByUser.set(u.id, gIds);
    sectorIdsByUser.set(u.id, sIds);
  }

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      type: "user" as const,
      area: u.primarySector ? `${u.primarySector.group?.name ?? ""} / ${u.primarySector.name}` : u.primaryGroup?.name ?? null,
      groupIds: Array.from(groupIdsByUser.get(u.id) ?? []),
      sectorIds: Array.from(sectorIdsByUser.get(u.id) ?? []),
    })),
    groups: groups.map((g) => ({ id: g.id, name: g.name, type: "group" as const })),
    sectors: sectors.map((s) => ({ id: s.id, name: `${s.group.name} / ${s.name}`, type: "sector" as const })),
  });
}
