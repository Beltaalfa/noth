import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IconLayoutDashboard, IconTools, IconUser, IconReport, IconMessageCircle } from "@tabler/icons-react";
import { getToolsForUser, getReportsForUser, canUserAccessAlteracaoDespesaPmg, getClientsForHelpdesk, getClientMenuFeatures, getUserMenuOverrides } from "@/lib/permissions";
import { PortalLayoutClient } from "@/components/layout/PortalLayoutClient";
import { AdminRedirectGuard } from "@/components/layout/AdminRedirectGuard";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  const isAdmin = role === "admin";
  const [tools, reports, alteracaoDespesaAcesso, clients, menuFeatures, userOverrides] = await Promise.all([
    getToolsForUser(userId),
    getReportsForUser(userId, isAdmin).catch(() => []),
    canUserAccessAlteracaoDespesaPmg(userId),
    getClientsForHelpdesk(userId, isAdmin),
    getClientMenuFeatures(userId, isAdmin),
    isAdmin ? Promise.resolve({ allowRelatorios: null, allowAjusteDespesa: null, allowNegociacoes: null, allowHelpdesk: null }) : getUserMenuOverrides(userId),
  ]);

  const allow = (clientHas: boolean, userAllow: boolean | null) => clientHas && (userAllow !== false);
  const sidebarItems = [
    { href: "/dashboard", label: "Dashboard", icon: <IconLayoutDashboard /> },
    ...(allow(menuFeatures.relatorios, userOverrides.allowRelatorios) && reports.length > 0 ? [{ href: "/relatorios", label: "Relatórios", icon: <IconReport /> }] : []),
    ...(allow(menuFeatures.ajusteDespesa, userOverrides.allowAjusteDespesa) && alteracaoDespesaAcesso
      ? [{ href: "/ferramentas/alteracao-despesa", label: "Ajuste de Despesas", icon: <IconTools /> }]
      : []),
    ...(allow(menuFeatures.helpdesk, userOverrides.allowHelpdesk) && clients.length > 0 ? [{ href: "/helpdesk", label: "Helpdesk", icon: <IconMessageCircle /> }] : []),
    ...(allow(menuFeatures.negociacoes, userOverrides.allowNegociacoes) ? [{ href: "/ferramentas/negociacoes", label: "Negociações", icon: <IconTools /> }] : []),
    ...tools.filter((t) => t.slug !== "negociacoes").map((t) => ({
      href: `/ferramentas/${t.slug}`,
      label: t.name,
      icon: <IconTools />,
    })),
    { href: "/conta", label: "Minha conta", icon: <IconUser /> },
  ];

  const content = (
    <PortalLayoutClient
      sidebarItems={sidebarItems}
      title="Hub"
    >
      {children}
    </PortalLayoutClient>
  );

  if (role === "admin") {
    return <AdminRedirectGuard>{content}</AdminRedirectGuard>;
  }
  return content;
}
