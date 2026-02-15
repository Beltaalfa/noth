import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { IconLayoutDashboard, IconTools, IconUser } from "@tabler/icons-react";
import { getToolsForUser } from "@/lib/permissions";
import { LayoutWithSidebar } from "@/components/layout/LayoutWithSidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  if (role === "admin") redirect("/admin/config/clientes");

  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  const tools = await getToolsForUser(userId);

  const sidebarItems = [
    { href: "/dashboard", label: "Dashboard", icon: <IconLayoutDashboard /> },
    ...tools.map((t) => ({
      href: `/ferramentas/${t.slug}`,
      label: t.name,
      icon: <IconTools />,
    })),
    { href: "/conta", label: "Minha conta", icon: <IconUser /> },
  ];

  return (
    <LayoutWithSidebar
      sidebarItems={sidebarItems}
      title="Hub"
    >
      {children}
    </LayoutWithSidebar>
  );
}
