"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconTicket, IconList, IconChartBar, IconBinaryTree, IconBell } from "@tabler/icons-react";

type Notification = {
  id: string;
  ticketId: string;
  messageId: string | null;
  type: string;
  readAt: string | null;
  ticket?: { id: string; subject: string | null };
};

type Perfil = {
  podeVerMeusChamados?: boolean;
  podeVerFilas?: boolean;
  podeVerAreasGeridas?: boolean;
  podeVerArvore?: boolean;
};

export function HelpdeskNav() {
  const pathname = usePathname();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    fetch("/api/helpdesk/meu-perfil")
      .then((r) => r.json())
      .then((d) => setPerfil(d))
      .catch(() => setPerfil(null));
  }, []);

  const fetchNotifications = useCallback(() => {
    fetch("/api/helpdesk/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications ?? []);
        setUnreadCount(d.unreadCount ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30000);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  const markAsRead = (ticketId: string) => {
    fetch("/api/helpdesk/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    }).then(() => fetchNotifications());
  };

  if (!perfil) return null;

  const base = "/helpdesk";
  const links: { href: string; label: string; show: boolean; icon: React.ReactNode }[] = [
    { href: `${base}/meus-chamados`, label: "Meus Chamados", show: true, icon: <IconTicket size={18} /> },
    { href: `${base}/filas`, label: "Filas de Chamados", show: !!perfil.podeVerFilas, icon: <IconList size={18} /> },
    { href: `${base}/areas-geridas`, label: "Áreas Geridas", show: !!perfil.podeVerAreasGeridas, icon: <IconChartBar size={18} /> },
    { href: `${base}/arvore`, label: "Árvore de Chamados", show: !!perfil.podeVerArvore, icon: <IconBinaryTree size={18} /> },
  ].filter((l) => l.show);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between border-b border-zinc-700/50">
        <nav className="flex gap-1">
        {links.map(({ href, label, icon }) => {
        const active = pathname === href || (href === `${base}/meus-chamados` && (pathname === base || pathname.startsWith(`${base}/meus-chamados`))) || (href !== `${base}/meus-chamados` && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {icon}
            {label}
          </Link>
        );
      })}
        </nav>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotif((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors"
          >
            <IconBell size={20} />
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white min-w-[18px] text-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {showNotif && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotif(false)} aria-hidden />
              <div className="absolute right-0 top-full mt-1 z-20 w-80 max-h-[400px] overflow-y-auto rounded-xl border border-zinc-700/50 bg-zinc-900 shadow-xl">
                <div className="p-3 border-b border-zinc-700/50 font-medium text-zinc-100">
                  Notificações
                </div>
                <div className="max-h-[340px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-zinc-500">Nenhuma notificação</p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={`/helpdesk/meus-chamados`}
                        onClick={() => { markAsRead(n.ticketId); setShowNotif(false); }}
                        className={`block px-4 py-3 hover:bg-zinc-800/50 border-b border-zinc-700/30 last:border-0 ${!n.readAt ? "bg-blue-900/10" : ""}`}
                      >
                        <p className="text-sm text-zinc-200 truncate">{n.ticket?.subject || "Novo chamado"}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {n.type === "new_ticket" ? "Novo chamado" : n.type === "awaiting_approval" ? "Aguardando aprovação" : "Atualização"}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
