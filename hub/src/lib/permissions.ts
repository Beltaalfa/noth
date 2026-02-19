import { prisma } from "./prisma";

async function getClientIdsForUser(userId: string): Promise<Set<string>> {
  const clientIds = new Set<string>();
  const [uc, ug, us] = await Promise.all([
    prisma.userClientPermission.findMany({ where: { userId }, select: { clientId: true } }),
    prisma.userGroupPermission.findMany({ where: { userId }, include: { group: { select: { clientId: true } } } }),
    prisma.userSectorPermission.findMany({ where: { userId }, include: { sector: { include: { group: { select: { clientId: true } } } } } }),
  ]);
  for (const p of uc) clientIds.add(p.clientId);
  for (const p of ug) if (p.group.clientId) clientIds.add(p.group.clientId);
  for (const p of us) if (p.sector.group?.clientId) clientIds.add(p.sector.group.clientId);
  return clientIds;
}

export async function getToolsForUser(userId: string): Promise<{ id: string; name: string; slug: string; clientId: string }[]> {
  const clientIds = await getClientIdsForUser(userId);
  if (clientIds.size === 0) return [];

  const clientTools = await prisma.clientTool.findMany({
    where: { clientId: { in: Array.from(clientIds) } },
    include: { tool: true },
  });

  const seen = new Set<string>();
  const tools: { id: string; name: string; slug: string; clientId: string }[] = [];
  for (const ct of clientTools) {
    if (ct.tool.status === "active" && ct.tool.type !== "powerbi_report" && !seen.has(ct.tool.id)) {
      seen.add(ct.tool.id);
      tools.push({ id: ct.tool.id, name: ct.tool.name, slug: ct.tool.slug, clientId: ct.tool.clientId });
    }
  }
  return tools;
}

export async function canUserAccessTool(userId: string, toolId: string): Promise<boolean> {
  const tools = await getToolsForUser(userId);
  return tools.some((t) => t.id === toolId);
}

export type ReportForUser = {
  id: string;
  name: string;
  slug: string;
  clientId: string;
  client: { name: string; logoUrl: string | null };
};

/** Relatórios acessíveis: apenas dos clientes/grupos/setores do cadastro do usuário (mesma lógica do Helpdesk). */
export async function getReportsForUser(
  userId: string,
  isAdmin?: boolean
): Promise<ReportForUser[]> {
  const isAdminRole = isAdmin === true;
  const clientIdsRelatorios = await getClientIdsForRelatorios(userId, isAdminRole);
  if (clientIdsRelatorios.length === 0) return [];

  const clientIdSet = new Set(clientIdsRelatorios);
  const [groupPerms, sectorPerms] = await Promise.all([
    prisma.userGroupPermission.findMany({ where: { userId }, select: { groupId: true } }),
    prisma.userSectorPermission.findMany({ where: { userId }, select: { sectorId: true } }),
  ]);
  const groupIds = groupPerms.map((p) => p.groupId);
  const sectorIds = sectorPerms.map((p) => p.sectorId);

  const toolPerms = await prisma.toolPermission.findMany({
    where: {
      tool: { type: "powerbi_report", status: "active", clientId: { in: clientIdsRelatorios } },
      OR: [
        { principalType: "user", principalId: userId },
        ...(groupIds.length ? [{ principalType: "group" as const, principalId: { in: groupIds } }] : []),
        ...(sectorIds.length ? [{ principalType: "sector" as const, principalId: { in: sectorIds } }] : []),
      ],
    },
    include: { tool: { include: { client: { select: { name: true, logoUrl: true } } } } },
  });

  const seen = new Set<string>();
  const reports: ReportForUser[] = [];
  for (const tp of toolPerms) {
    const t = tp.tool;
    if (t && t.client && clientIdSet.has(t.clientId) && !seen.has(t.id)) {
      seen.add(t.id);
      reports.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        clientId: t.clientId,
        client: { name: t.client.name, logoUrl: t.client.logoUrl },
      });
    }
  }

  const toolsFromClients = await prisma.tool.findMany({
    where: {
      type: "powerbi_report",
      status: "active",
      clientId: { in: clientIdsRelatorios },
    },
    include: { client: { select: { name: true, logoUrl: true } } },
  });
  for (const t of toolsFromClients) {
    if (t.client && !seen.has(t.id)) {
      seen.add(t.id);
      reports.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        clientId: t.clientId,
        client: { name: t.client.name, logoUrl: t.client.logoUrl },
      });
    }
  }

  return reports;
}

export async function canUserAccessReport(
  userId: string,
  toolId: string,
  isAdmin?: boolean
): Promise<boolean> {
  const reports = await getReportsForUser(userId, isAdmin);
  return reports.some((r) => r.id === toolId);
}

export async function getClientsForUser(userId: string): Promise<{ id: string; name: string }[]> {
  const clientIds = await getClientIdsForUser(userId);
  if (clientIds.size === 0) return [];

  const clients = await prisma.client.findMany({
    where: { id: { in: Array.from(clientIds) }, deletedAt: null, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return clients;
}

/** Para o helpdesk: admin vê todos os clientes; demais usuários só os que têm permissão. */
export async function getClientsForHelpdesk(
  userId: string,
  isAdmin: boolean
): Promise<{ id: string; name: string }[]> {
  if (isAdmin) {
    const all = await prisma.client.findMany({
      where: { deletedAt: null, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return all;
  }
  return getClientsForUser(userId);
}

/** Funcionalidades do menu lateral por cliente (checkboxes em Admin → Clientes → Ferramentas). */
export type ClientMenuFeatures = {
  relatorios: boolean;
  ajusteDespesa: boolean;
  negociacoes: boolean;
  helpdesk: boolean;
};

export async function getClientMenuFeatures(
  userId: string,
  isAdmin: boolean
): Promise<ClientMenuFeatures> {
  const clients = await getClientsForHelpdesk(userId, isAdmin);
  if (clients.length === 0) {
    return { relatorios: false, ajusteDespesa: false, negociacoes: false, helpdesk: false };
  }
  const clientIds = clients.map((c) => c.id);
  const rows = await prisma.client.findMany({
    where: { id: { in: clientIds }, deletedAt: null, status: "active" },
    select: {
      relatoriosEnabled: true,
      ajusteDespesaEnabled: true,
      negociacoesEnabled: true,
      helpdeskEnabled: true,
    },
  });
  return {
    relatorios: rows.some((r) => r.relatoriosEnabled),
    ajusteDespesa: rows.some((r) => r.ajusteDespesaEnabled),
    negociacoes: rows.some((r) => r.negociacoesEnabled),
    helpdesk: rows.some((r) => r.helpdeskEnabled),
  };
}

/** Liberações de funções do usuário (null = respeita o cliente; false = oculta; true = libera). */
export type UserMenuOverrides = {
  allowRelatorios: boolean | null;
  allowAjusteDespesa: boolean | null;
  allowNegociacoes: boolean | null;
  allowHelpdesk: boolean | null;
};

export async function getUserMenuOverrides(userId: string): Promise<UserMenuOverrides> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      allowRelatorios: true,
      allowAjusteDespesa: true,
      allowNegociacoes: true,
      allowHelpdesk: true,
    },
  });
  if (!user) {
    return { allowRelatorios: null, allowAjusteDespesa: null, allowNegociacoes: null, allowHelpdesk: null };
  }
  return {
    allowRelatorios: user.allowRelatorios ?? null,
    allowAjusteDespesa: user.allowAjusteDespesa ?? null,
    allowNegociacoes: user.allowNegociacoes ?? null,
    allowHelpdesk: user.allowHelpdesk ?? null,
  };
}

/** Clientes para os quais o usuário pode acessar Relatórios. Admin: todos com relatoriosEnabled. Não-admin: apenas clientes com vínculo direto (UserClientPermission) e relatoriosEnabled. */
export async function getClientIdsForRelatorios(
  userId: string,
  isAdmin: boolean
): Promise<string[]> {
  const overrides = await getUserMenuOverrides(userId);
  if (overrides.allowRelatorios === false) return [];

  if (isAdmin) {
    const rows = await prisma.client.findMany({
      where: { deletedAt: null, status: "active", relatoriosEnabled: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  const directClientIds = await prisma.userClientPermission
    .findMany({ where: { userId }, select: { clientId: true } })
    .then((rows) => rows.map((r) => r.clientId));
  if (directClientIds.length === 0) return [];

  const rows = await prisma.client.findMany({
    where: {
      id: { in: directClientIds },
      deletedAt: null,
      status: "active",
      relatoriosEnabled: true,
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Clientes para os quais o usuário pode acessar Negociações (checkboxes: cliente.negociacoesEnabled + user.allowNegociacoes). Admin retorna todos com negociacoesEnabled. */
export async function getClientIdsForNegociacoes(
  userId: string,
  isAdmin: boolean
): Promise<string[]> {
  const overrides = await getUserMenuOverrides(userId);
  if (overrides.allowNegociacoes === false) return [];

  const clients = await getClientsForHelpdesk(userId, isAdmin);
  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);
  const rows = await prisma.client.findMany({
    where: {
      id: { in: clientIds },
      deletedAt: null,
      status: "active",
      negociacoesEnabled: true,
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export type AlteracaoDespesaTool = {
  id: string;
  clientId: string;
  client: { id: string; name: string };
};

export async function getAlteracaoDespesaToolsForUser(
  userId: string
): Promise<AlteracaoDespesaTool[]> {
  const [groupPerms, sectorPerms] = await Promise.all([
    prisma.userGroupPermission.findMany({ where: { userId }, select: { groupId: true } }),
    prisma.userSectorPermission.findMany({ where: { userId }, select: { sectorId: true } }),
  ]);
  const groupIds = groupPerms.map((p) => p.groupId);
  const sectorIds = sectorPerms.map((p) => p.sectorId);

  const clientIds = await getClientIdsForUser(userId);

  const toolPerms = await prisma.toolPermission.findMany({
    where: {
      tool: { slug: "alteracao-despesa", status: "active", clientId: { in: Array.from(clientIds) } },
      OR: [
        { principalType: "user", principalId: userId },
        ...(groupIds.length ? [{ principalType: "group" as const, principalId: { in: groupIds } }] : []),
        ...(sectorIds.length ? [{ principalType: "sector" as const, principalId: { in: sectorIds } }] : []),
      ],
    },
    include: { tool: { include: { client: { select: { id: true, name: true } } } } },
  });

  const seen = new Set<string>();
  const tools: AlteracaoDespesaTool[] = [];
  for (const tp of toolPerms) {
    const t = tp.tool;
    if (t?.client && !seen.has(t.id)) {
      seen.add(t.id);
      tools.push({
        id: t.id,
        clientId: t.clientId,
        client: { id: t.client.id, name: t.client.name },
      });
    }
  }
  return tools;
}

export async function canUserAccessAlteracaoDespesa(
  userId: string,
  toolId: string,
  clientId: string
): Promise<boolean> {
  const clientIds = await getClientIdsForUser(userId);
  if (!clientIds.has(clientId)) return false;

  const tools = await getAlteracaoDespesaToolsForUser(userId);
  return tools.some((t) => t.id === toolId && t.clientId === clientId);
}

export async function canUserAccessAlteracaoDespesaForClient(
  userId: string,
  clientId: string
): Promise<boolean> {
  const tools = await getAlteracaoDespesaToolsForUser(userId);
  return tools.some((t) => t.clientId === clientId);
}

/** Acesso direto à Alteração de Despesa - admin; ou ToolPermission; ou ClientTool; ou cliente PMG */
export async function canUserAccessAlteracaoDespesaPmg(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === "admin") return true;

  // Permissão via ToolPermission (Admin → Permissões)
  const alteracaoTools = await getAlteracaoDespesaToolsForUser(userId);
  if (alteracaoTools.length > 0) return true;

  // Ferramenta visível em Ferramentas (ClientTool)
  const allTools = await getToolsForUser(userId);
  if (allTools.some((t) => t.slug === "alteracao-despesa")) return true;

  const clientIds = await getClientIdsForUser(userId);
  if (clientIds.size === 0) return false;

  const pmgClient = await prisma.client.findFirst({
    where: {
      id: { in: Array.from(clientIds) },
      deletedAt: null,
      status: "active",
      OR: [
        { name: { contains: "PMG", mode: "insensitive" } },
        { name: { contains: "Rede PMG", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return !!pmgClient;
}
