"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Sidebar, type SidebarItem } from "./Sidebar";
import { Button } from "@/components/ui/Button";
import { IconLogout, IconMenu2 } from "@tabler/icons-react";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex">
      <Sidebar
        items={sidebarItems}
        title={title}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
      <main className="flex-1 min-h-screen flex flex-col lg:ml-64 w-full min-w-0">
        <header className="h-14 lg:h-16 border-b border-zinc-800 shrink-0 flex items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            aria-label="Abrir menu"
          >
            <IconMenu2 size={24} strokeWidth={2} />
          </button>
          <span className="text-sm font-medium text-zinc-300 lg:text-zinc-500 truncate">{title}</span>
        </header>
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto">{children}</div>
      </main>
    </div>
  );
}
