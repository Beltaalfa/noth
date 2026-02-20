"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LayoutWithSidebar } from "./LayoutWithSidebar";
import { IconArrowLeft, IconLogout } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";

export function PortalLayoutClient({
  sidebarItems,
  title,
  children,
}: {
  sidebarItems: { href: string; label: string; icon: React.ReactNode }[];
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHelpdesk = pathname?.startsWith("/helpdesk");

  if (isHelpdesk) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="h-14 shrink-0 border-b border-zinc-800 flex items-center justify-between px-3 sm:px-4 lg:px-8 gap-3">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              <IconArrowLeft size={18} />
              Voltar ao Hub
            </Link>
            <span className="text-zinc-600">|</span>
            <span className="text-sm font-medium text-zinc-200">Helpdesk</span>
          </div>
          <Button variant="ghost" className="gap-2 text-zinc-400" onClick={() => signOut({ callbackUrl: "/login" })}>
            <IconLogout size={18} />
            Sair
          </Button>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto">{children}</main>
      </div>
    );
  }

  return (
    <LayoutWithSidebar sidebarItems={sidebarItems} title={title}>
      {children}
    </LayoutWithSidebar>
  );
}
