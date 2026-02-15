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
      <Sidebar
        items={sidebarItems}
        title={title}
        footer={
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full justify-start gap-3 text-zinc-400 hover:text-zinc-200"
          >
            <IconLogout size={20} strokeWidth={2} />
            Sair
          </Button>
        }
      />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <header className="h-16 border-b border-zinc-800 shrink-0" />
        <div className="flex-1 p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
