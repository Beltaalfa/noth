"use client";

import { useState, useEffect, useCallback } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

type Ticket = {
  id: string;
  subject: string | null;
  status: string;
  creator: { id: string; name: string };
  client: { name: string };
  group?: { name: string } | null;
  sector?: { name: string } | null;
  createdAt: string;
  slaLimitHours?: number | null;
  _count: { messages: number };
};

export function MinhasAprovacoesPanel({
  clientId,
  onApprove,
  onReject,
}: {
  clientId?: string;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const q = clientId ? `?clientId=${clientId}` : "";
      const res = await fetch(`/api/helpdesk/tickets/awaiting-approval${q}`);
      const data = await res.json();
      if (res.ok) setTickets(Array.isArray(data) ? data : []);
      else setTickets([]);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const getCategoria = (t: Ticket) => t.group?.name ?? t.sector?.name ?? "-";

  const isSlaComprometido = (t: Ticket) => {
    if (!t.slaLimitHours) return false;
    const limite = new Date(t.createdAt).getTime() + t.slaLimitHours * 60 * 60 * 1000;
    return Date.now() > limite;
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Chamado aprovado");
        setSelectedId(null);
        setComment("");
        fetchTickets();
        onApprove?.();
      } else {
        toast.error(data.error ?? "Erro ao aprovar");
      }
    } catch {
      toast.error("Erro ao aprovar");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!comment.trim()) {
      toast.error("Comentário obrigatório ao reprovar");
      return;
    }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Chamado reprovado");
        setSelectedId(null);
        setComment("");
        fetchTickets();
        onReject?.();
      } else {
        toast.error(data.error ?? "Erro ao reprovar");
      }
    } catch {
      toast.error("Erro ao reprovar");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && tickets.length === 0) {
    return <p className="text-zinc-500 text-sm py-4">Carregando...</p>;
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-8 text-center text-zinc-500 text-sm">
        Nenhum chamado aguardando sua aprovação
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700/50">
              <th className="px-3 py-2 text-left font-medium text-zinc-400">Protocolo</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">Assunto</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">Solicitante</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">Categoria</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">Data</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">SLA</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-400">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-b border-zinc-700/30">
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">#{t.id.slice(-6)}</td>
                <td className="px-3 py-2.5 text-zinc-200 max-w-[180px] truncate">{t.subject || "Sem assunto"}</td>
                <td className="px-3 py-2.5 text-zinc-400">{t.creator.name}</td>
                <td className="px-3 py-2.5 text-zinc-400">{getCategoria(t)}</td>
                <td className="px-3 py-2.5 text-zinc-500 text-xs">
                  {new Date(t.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2.5">
                  {isSlaComprometido(t) && (
                    <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400">
                      SLA comprometido
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {selectedId === t.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Comentário (obrigatório ao reprovar)"
                        rows={2}
                        className="w-full min-w-[200px] resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500"
                      />
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => handleApprove(t.id)}
                          disabled={!!actionLoading}
                          className="gap-1 text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <IconCheck size={14} />
                          Aprovar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleReject(t.id)}
                          disabled={!!actionLoading || !comment.trim()}
                          className="gap-1 text-red-400 hover:bg-red-500/20"
                        >
                          <IconX size={14} />
                          Reprovar
                        </Button>
                        <Button variant="ghost" onClick={() => { setSelectedId(null); setComment(""); }} className="px-2 py-1 text-xs">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setSelectedId(t.id)} className="px-2 py-1 text-xs">
                      Decidir
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
