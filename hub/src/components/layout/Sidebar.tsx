"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";

export interface SidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
}

interface SidebarProps {
  items: SidebarItem[];
  title?: string;
  logo?: ReactNode;
  footer?: ReactNode;
  /** No mobile: controla se o drawer está aberto */
  mobileOpen?: boolean;
  /** No mobile: chamado ao fechar (clique fora ou botão) */
  onClose?: () => void;
}

export function Sidebar({ items, title = "Hub", logo, footer, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay no mobile ao abrir o menu */}
      {mobileOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-label="Fechar menu"
        />
      )}
      <aside
        className={`
          fixed left-0 top-0 z-40 h-screen w-64 max-w-[85vw] flex flex-col border-r border-zinc-800 bg-black
          transition-transform duration-200 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex h-14 lg:h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-4 lg:px-6">
          <div className="flex items-center gap-2 min-w-0">
            {logo || (
              <span className="text-lg font-semibold text-zinc-100 truncate">{title}</span>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 lg:hidden"
              aria-label="Fechar menu"
            >
              <IconX size={22} strokeWidth={2} />
            </button>
          )}
        </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                    transition-colors
                    ${
                      isActive
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }
                  `}
                >
                  <span className="flex-shrink-0 [&>svg]:size-5 [&>svg]:stroke-[2]">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {footer ? (
        <div className="shrink-0 border-t border-zinc-800 p-4">
          {footer}
        </div>
      ) : null}
      </aside>
    </>
  );
}
