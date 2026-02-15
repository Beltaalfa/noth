"use client";

import { signOut } from "next-auth/react";
import { Sidebar, type SidebarItem } from "./Sidebar";
import { Button } from "@/components/ui/Button";
import { IconLogout } from "@tabler/icons-react";

interface LayoutWithSidebarProps {
  sidebarItems: SidebarItem[];
  title?: string;
  children: React.ReactNode;
}

export function LayoutWithSidebar({
  sidebarItems,
  title = "Hub",
  children,
}: LayoutWithSidebarProps) {
  return (
    <div className="min-h-screen flex">
      <Sidebar items={sidebarItems} title={title} />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-end px-6">
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="gap-2"
          >
            <IconLogout size={18} strokeWidth={2} />
            Sair
          </Button>
        </header>
        <div className="flex-1 p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
