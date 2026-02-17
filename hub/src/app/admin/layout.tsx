import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LayoutWithSidebar } from "@/components/layout/LayoutWithSidebar";
import {
  IconUsers,
  IconUserCircle,
  IconUsersGroup,
  IconBuilding,
  IconDatabase,
  IconTools,
  IconReport,
  IconChartBar,
  IconList,
  IconMessageCircle,
} from "@tabler/icons-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") redirect("/dashboard");

  const sidebarItems = [
    { href: "/admin/config/clientes", label: "Clientes", icon: <IconUsers /> },
    { href: "/admin/config/usuarios", label: "Usuários", icon: <IconUserCircle /> },
    { href: "/admin/config/grupos", label: "Grupos", icon: <IconUsersGroup /> },
    { href: "/admin/config/setores", label: "Setores", icon: <IconBuilding /> },
    { href: "/admin/config/conexoes", label: "Conexões de Banco", icon: <IconDatabase /> },
    { href: "/admin/alteracao-despesa", label: "Ajuste de Despesas", icon: <IconTools /> },
    { href: "/admin/negociacoes", label: "Negociações", icon: <IconTools /> },
    { href: "/admin/helpdesk", label: "Helpdesk", icon: <IconMessageCircle /> },
    { href: "/admin/helpdesk/aprovacoes", label: "Aprovações Helpdesk", icon: <IconMessageCircle /> },
    { href: "/admin/config/relatorios", label: "Relatórios", icon: <IconReport /> },
    { href: "/admin/audit-relatorios", label: "Auditoria de Relatórios", icon: <IconChartBar /> },
    { href: "/admin/logs", label: "Logs", icon: <IconList /> },
  ];

  return (
    <LayoutWithSidebar sidebarItems={sidebarItems} title="Admin">
      {children}
    </LayoutWithSidebar>
  );
}
