"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type ArvoreNode = {
  id: string;
  label: string;
  type: "group" | "sector" | "status";
  count?: number;
  children?: ArvoreNode[];
  ticketIds?: string[];
};

type Ticket = {
  id: string;
  subject: string | null;
  status: string;
  creator: { name: string };
  client: { name: string };
  group?: { name: string } | null;
  sector?: { name: string } | null;
  tipoSolicitacao?: { nome: string } | null;
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto", aguardando_atendimento: "Aguard. atend.", em_atendimento: "Em atendimento",
  aguardando_feedback_usuario: "Aguard. feedback", concluido: "Concluído", closed: "Fechado",
  pending_approval: "Pend. aprovação", custo_aguardando_aprovacao: "Pend. autorização",
};

function aggregateByArea(nodes: ArvoreNode[]): { id: string; label: string; abertos: number; emAtendimento: number; concluidos: number; pendentesAprovacao: number; pendentesAutorizacao: number }[] {
  const openStatuses = ["open", "aguardando_atendimento", "agendado_com_usuario", "encaminhado_operador", "reaberto"];
  const result: { id: string; label: string; abertos: number; emAtendimento: number; concluidos: number; pendentesAprovacao: number; pendentesAutorizacao: number }[] = [];
  for (const g of nodes) {
    if (g.type !== "group") continue;
    let abertos = 0, emAtendimento = 0, concluidos = 0, pendentesAprovacao = 0, pendentesAutorizacao = 0;
    for (const s of g.children ?? []) {
      for (const st of s.children ?? []) {
        const c = st.count ?? 0;
        if (openStatuses.includes(st.label)) abertos += c;
        else if (st.label === "em_atendimento") emAtendimento += c;
        else if (["concluido", "closed"].includes(st.label)) concluidos += c;
        else if (st.label === "pending_approval") pendentesAprovacao += c;
        else if (st.label === "custo_aguardando_aprovacao") pendentesAutorizacao += c;
      }
    }
    result.push({ id: g.id, label: g.label, abertos, emAtendimento, concluidos, pendentesAprovacao, pendentesAutorizacao });
  }
  return result;
}

export function AreasGeridasPage() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");
  const sectorId = searchParams.get("sectorId");
  const [tree, setTree] = useState<ArvoreNode[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArvore = useCallback(async () => {
    const res = await fetch("/api/helpdesk/tickets/arvore");
    const data = await res.json();
    if (res.ok) setTree(Array.isArray(data) ? data : []);
    else setTree([]);
  }, []);

  const fetchTickets = useCallback(async () => {
    if (!groupId && !sectorId) return;
    const params = new URLSearchParams({ view: "areas_geridas" });
    if (groupId) params.set("groupId", groupId);
    if (sectorId) params.set("sectorId", sectorId);
    const res = await fetch(`/api/helpdesk/tickets?${params}`);
    const data = await res.json();
    if (res.ok) setTickets(Array.isArray(data) ? data : []);
    else setTickets([]);
  }, [groupId, sectorId]);

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchArvore().then(() => setLoading(false));
    });
  }, [fetchArvore]);

  useEffect(() => {
    queueMicrotask(() => {
      if (groupId || sectorId) {
        setLoading(true);
        fetchTickets().then(() => setLoading(false));
      } else {
        setTickets([]);
      }
    });
  }, [groupId, sectorId, fetchTickets]);

  const areas = aggregateByArea(tree);
  const showList = !!groupId || !!sectorId;

  if (loading && !showList) return <p className="text-zinc-500 text-sm py-4">Carregando...</p>;

  if (showList) {
    const backHref = "/helpdesk/areas-geridas";
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Link href={backHref} className="text-sm text-zinc-400 hover:text-zinc-200">← Voltar às áreas</Link>
          <h1 className="text-2xl font-semibold text-zinc-100">Chamados da área</h1>
        </header>
        {loading ? (
          <p className="text-zinc-500 text-sm py-4">Carregando...</p>
        ) : tickets.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4">Nenhum chamado nesta área.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700/50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Nº</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Assunto</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-400">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-700/30 hover:bg-zinc-800/30">
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">#{t.id.slice(-8)}</td>
                    <td className="px-3 py-2.5 text-zinc-200">{t.subject ?? "—"}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{t.client.name}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{t.tipoSolicitacao?.nome ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-zinc-700/50 text-zinc-300">
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-500 text-xs">
                      {new Date(t.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Áreas Geridas</h1>
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-8 text-center text-zinc-500">
          Nenhuma área gerenciada ou sem permissão.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">Áreas Geridas</h1>
        <p className="mt-1 text-sm text-zinc-500">Resumo por área. Clique em &quot;Ver chamados&quot; para listar.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((a) => (
          <div key={a.id} className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
            <h2 className="font-medium text-zinc-200 mb-3">{a.label}</h2>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div className="text-zinc-500">Abertos</div>
              <div className="font-medium text-amber-400">{a.abertos}</div>
              <div className="text-zinc-500">Em atendimento</div>
              <div className="font-medium text-blue-400">{a.emAtendimento}</div>
              <div className="text-zinc-500">Concluídos</div>
              <div className="font-medium text-zinc-300">{a.concluidos}</div>
              <div className="text-zinc-500">Pend. aprovação</div>
              <div className="font-medium text-purple-400">{a.pendentesAprovacao}</div>
              <div className="text-zinc-500">Pend. autorização</div>
              <div className="font-medium text-cyan-400">{a.pendentesAutorizacao}</div>
            </div>
            <Link href={`/helpdesk/areas-geridas?groupId=${a.id}`}>
              <Button variant="secondary">Ver chamados</Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
