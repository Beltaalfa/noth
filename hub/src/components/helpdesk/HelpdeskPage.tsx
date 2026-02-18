"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { IconPlus, IconSend, IconPaperclip, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MinhasAprovacoesPanel } from "./MinhasAprovacoesPanel";

type Cliente = { id: string; name: string };
type Ticket = {
  id: string;
  subject: string | null;
  status: string;
  creator: { id: string; name: string };
  client: { name: string };
  assigneeUser?: { name: string } | null;
  group?: { name: string } | null;
  sector?: { name: string } | null;
  _count: { messages: number };
  updatedAt: string;
  createdAt: string;
  slaLimitHours?: number | null;
};
type Summary = { abertos: number; emAndamento: number; aguardandoAprovacao: number; reprovados: number; encerrados: number };
type Message = {
  id: string;
  content: string;
  user: { name: string };
  attachments: { id: string; filename: string; storagePath: string }[];
  createdAt: string;
};
type Destinatarios = {
  users: { id: string; name: string; type: string }[];
  groups: { id: string; name: string; type: string }[];
  sectors: { id: string; name: string; type: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  closed: "Fechado",
  pending_approval: "Aguardando aprovação",
  rejected: "Reprovado",
  in_approval: "Em análise",
  approved: "Aprovado",
  cancelled: "Cancelado",
};

const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-500/20 text-amber-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  closed: "bg-zinc-600/50 text-zinc-400",
  pending_approval: "bg-purple-500/20 text-purple-400",
  rejected: "bg-red-500/20 text-red-400",
  in_approval: "bg-cyan-500/20 text-cyan-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-zinc-600/50 text-zinc-500",
};

export function HelpdeskPage({ clientes }: { clientes: Cliente[] }) {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<{
    id: string;
    messages: Message[];
    subject: string | null;
    status: string;
    creator: { id: string };
  } | null>(null);
  const [destinatarios, setDestinatarios] = useState<Destinatarios | null>(null);
  const [clientId, setClientId] = useState(clientes[0]?.id ?? "");
  const [assigneeType, setAssigneeType] = useState<"user" | "group" | "sector">("user");
  const [assigneeId, setAssigneeId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tabFiltro, setTabFiltro] = useState<"abertos" | "reprovados" | "encerrados">("abertos");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exigeValidacao, setExigeValidacao] = useState(false);
  const [showMinhasAprovacoes, setShowMinhasAprovacoes] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);
  const [resubmitSubject, setResubmitSubject] = useState("");
  const [resubmitContent, setResubmitContent] = useState("");
  const [tiposSolicitacao, setTiposSolicitacao] = useState<{ id: string; nome: string; parent_nome: string | null }[]>([]);
  const [tipoSolicitacaoId, setTipoSolicitacaoId] = useState<string>("");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const q = clientId ? `?clientId=${clientId}` : "";
      const res = await fetch(`/api/helpdesk/tickets${q}`);
      const data = await res.json();
      if (res.ok) setTickets(Array.isArray(data) ? data : []);
      else setTickets([]);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const fetchSummary = useCallback(async () => {
    const q = clientId ? `?clientId=${clientId}` : "";
    const res = await fetch(`/api/helpdesk/tickets/summary${q}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
    else setSummary(null);
  }, [clientId]);

  const fetchTicket = useCallback(async (id: string) => {
    const res = await fetch(`/api/helpdesk/tickets/${id}`);
    const data = await res.json();
    if (res.ok) {
      setSelectedTicket({
        id: data.id,
        messages: data.messages ?? [],
        subject: data.subject,
        status: data.status,
        creator: { id: data.creator?.id ?? "" },
      });
      await fetch(`/api/helpdesk/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id }),
      });
      fetchNotifications();
    } else {
      toast.error(data.error ?? "Erro ao carregar");
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/helpdesk/notifications?unreadOnly=true");
    const data = await res.json();
    if (res.ok) setUnreadCount(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const iv = setInterval(fetchNotifications, 30000);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  const fetchDestinatarios = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(`/api/helpdesk/destinatarios?clientId=${clientId}`);
    const data = await res.json();
    if (res.ok) setDestinatarios(data);
    else setDestinatarios(null);
  }, [clientId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    setClientId(clientes[0]?.id ?? "");
  }, [clientes]);

  useEffect(() => {
    if (showNew && clientId) fetchDestinatarios();
  }, [showNew, clientId, fetchDestinatarios]);

  const fetchTiposSolicitacao = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(`/api/helpdesk/tipos?clientId=${clientId}`);
    const data = await res.json();
    if (res.ok) setTiposSolicitacao(Array.isArray(data) ? data.filter((t: { status?: string }) => t.status === "A") : []);
    else setTiposSolicitacao([]);
  }, [clientId]);

  useEffect(() => {
    if (showNew && clientId) fetchTiposSolicitacao();
  }, [showNew, clientId, fetchTiposSolicitacao]);

  const handleCreate = async () => {
    if (!clientId || !assigneeId || !content.trim()) {
      toast.error("Preencha cliente, destinatário e mensagem");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          subject: subject.trim() || undefined,
          assigneeType,
          assigneeId,
          content: content.trim(),
          tipoSolicitacaoId: tipoSolicitacaoId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Ticket criado");
        setShowNew(false);
        setSubject("");
        setContent("");
        setAssigneeId("");
        setTipoSolicitacaoId("");
        fetchTickets();
        fetchSummary();
      } else {
        toast.error(data.error ?? "Erro ao criar");
      }
    } catch {
      toast.error("Erro ao criar ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyContent.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyContent("");
        fetchTicket(selectedTicket.id);
        fetchTickets();
      } else {
        toast.error(data.error ?? "Erro ao enviar");
      }
    } catch {
      toast.error("Erro ao enviar");
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!selectedTicket || !resubmitContent.trim()) return;
    setLoading(true);
    try {
      const patchRes = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: resubmitSubject.trim() || undefined, content: resubmitContent.trim() }),
      });
      if (!patchRes.ok) {
        const d = await patchRes.json();
        toast.error(d.error ?? "Erro ao atualizar");
        return;
      }
      const resubmitRes = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}/resubmit`, {
        method: "POST",
      });
      const data = await resubmitRes.json();
      if (resubmitRes.ok) {
        toast.success("Chamado reenviado para aprovação");
        setShowResubmit(false);
        setResubmitSubject("");
        setResubmitContent("");
        fetchTicket(selectedTicket.id);
        fetchTickets();
        fetchSummary();
      } else {
        toast.error(data.error ?? "Erro ao reenviar");
      }
    } catch {
      toast.error("Erro ao reenviar");
    } finally {
      setLoading(false);
    }
  };

  const getAssigneeLabel = (t: Ticket) => {
    if (t.assigneeUser) return t.assigneeUser.name;
    if (t.group) return t.group.name;
    if (t.sector) return t.sector.name;
    return "-";
  };

  const isOpenStatus = (s: string) => ["open", "in_progress", "pending_approval"].includes(s);
  const ticketsFiltrados = tickets.filter((t) => {
    if (tabFiltro === "abertos") return isOpenStatus(t.status);
    if (tabFiltro === "reprovados") return t.status === "rejected";
    return t.status === "closed";
  });
  const ticketsComValidacao = exigeValidacao
    ? ticketsFiltrados.filter((t) => ["pending_approval", "rejected"].includes(t.status))
    : ticketsFiltrados;

  const isSlaComprometido = (t: Ticket) => {
    if (!t.slaLimitHours) return false;
    const limite = new Date(t.createdAt).getTime() + t.slaLimitHours * 60 * 60 * 1000;
    return Date.now() > limite;
  };

  const assigneeOptions = destinatarios
    ? [
        ...destinatarios.users.map((u) => ({ id: u.id, name: u.name, type: "user" as const })),
        ...destinatarios.groups.map((g) => ({ id: g.id, name: g.name, type: "group" as const })),
        ...destinatarios.sectors.map((s) => ({ id: s.id, name: s.name, type: "sector" as const })),
      ]
    : [];

  return (
    <div className="max-w-5xl space-y-6">
      <header className="flex items-center justify-between border-b border-zinc-700/50 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Helpdesk</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Mensagens e solicitações
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {unreadCount} nova{unreadCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <IconPlus size={18} />
          Novo ticket
        </Button>
      </header>

      {summary && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
          <button
            onClick={() => { setTabFiltro("abertos"); setShowMinhasAprovacoes(false); }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">{summary.abertos}</span>
            Abertos
          </button>
          <button
            onClick={() => { setTabFiltro("abertos"); setShowMinhasAprovacoes(false); }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">{summary.emAndamento}</span>
            Em andamento
          </button>
          <button
            onClick={() => setShowMinhasAprovacoes(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">{summary.aguardandoAprovacao}</span>
            Aguardando aprovação
          </button>
          <button
            onClick={() => { setTabFiltro("reprovados"); setShowMinhasAprovacoes(false); }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">{summary.reprovados}</span>
            Reprovados
          </button>
          <button
            onClick={() => { setTabFiltro("encerrados"); setShowMinhasAprovacoes(false); }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-zinc-600/50 px-2 py-0.5 text-xs text-zinc-400">{summary.encerrados}</span>
            Encerrados
          </button>
        </div>
      )}

      {clientes.length > 1 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <Modal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        title="Novo Chamado"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {clientes.length > 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Cliente</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Departamento / Destinatário</label>
            <div className="flex gap-2">
              <select
                value={assigneeType}
                onChange={(e) => {
                  setAssigneeType(e.target.value as "user" | "group" | "sector");
                  setAssigneeId("");
                }}
                className="w-32 rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="user">Usuário</option>
                <option value="group">Grupo</option>
                <option value="sector">Setor</option>
              </select>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Selecione o destinatário...</option>
                {assigneeOptions
                  .filter((o) => o.type === assigneeType)
                  .map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
              </select>
            </div>
          </div>
          {tiposSolicitacao.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Tipo de Solicitação</label>
              <select
                value={tipoSolicitacaoId}
                onChange={(e) => setTipoSolicitacaoId(e.target.value)}
                className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Nenhum</option>
                {tiposSolicitacao.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.parent_nome ? `${t.parent_nome} › ${t.nome}` : t.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Assunto</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Assunto do chamado"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Mensagem</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Descreva aqui o seu chamado"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <IconPaperclip size={16} />
            <span>Anexar arquivos em breve</span>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
            <Button variant="secondary" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              Criar Chamado
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showResubmit} onClose={() => setShowResubmit(false)} title="Editar e reenviar" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Assunto</label>
            <input
              value={resubmitSubject}
              onChange={(e) => setResubmitSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">Nova mensagem (obrigatório)</label>
            <textarea
              value={resubmitContent}
              onChange={(e) => setResubmitContent(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Descreva as alterações realizadas..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
            <Button variant="secondary" onClick={() => setShowResubmit(false)}>Cancelar</Button>
            <Button onClick={handleResubmit} disabled={loading || !resubmitContent.trim()}>Reenviar para aprovação</Button>
          </div>
        </div>
      </Modal>

      <div className="flex items-center gap-4 border-b border-zinc-700/50">
        <div className="flex gap-1">
          <button
            onClick={() => { setTabFiltro("abertos"); setShowMinhasAprovacoes(false); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              !showMinhasAprovacoes && tabFiltro === "abertos"
                ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Abertos
          </button>
          <button
            onClick={() => { setTabFiltro("reprovados"); setShowMinhasAprovacoes(false); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              !showMinhasAprovacoes && tabFiltro === "reprovados"
                ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Reprovados
          </button>
          <button
            onClick={() => { setTabFiltro("encerrados"); setShowMinhasAprovacoes(false); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              !showMinhasAprovacoes && tabFiltro === "encerrados"
                ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Encerrados
          </button>
          <button
            onClick={() => setShowMinhasAprovacoes(true)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              showMinhasAprovacoes
                ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Minhas Aprovações
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={exigeValidacao}
            onChange={(e) => setExigeValidacao(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800"
          />
          Exigem validação
        </label>
      </div>

      {showMinhasAprovacoes ? (
        <MinhasAprovacoesPanel
          clientId={clientId}
          onApprove={() => { fetchTickets(); fetchSummary(); }}
          onReject={() => { fetchTickets(); fetchSummary(); }}
        />
      ) : (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 overflow-hidden">
          {loading && !selectedTicket ? (
            <p className="text-zinc-500 text-sm py-4">Carregando...</p>
          ) : ticketsComValidacao.length === 0 ? (
            <p className="text-zinc-500 text-sm py-4">
              {tabFiltro === "abertos" ? "Nenhum chamado aberto" : tabFiltro === "reprovados" ? "Nenhum chamado reprovado" : "Nenhum chamado encerrado"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700/50">
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Protocolo</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Assunto</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Destinatário</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">SLA</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsComValidacao.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => fetchTicket(t.id)}
                      className={`border-b border-zinc-700/30 cursor-pointer transition-colors hover:bg-zinc-800/30 ${
                        selectedTicket?.id === t.id ? "bg-zinc-800/50" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">#{t.id.slice(-6)}</td>
                      <td className="px-3 py-2.5 text-zinc-200 max-w-[120px] truncate">{t.subject || "Sem assunto"}</td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[100px] truncate">{getAssigneeLabel(t)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[t.status] ?? "bg-zinc-700/50 text-zinc-400"}`}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {isSlaComprometido(t) && (
                          <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400">SLA comprometido</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500 text-xs">
                        {new Date(t.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden">
          {selectedTicket ? (
            <div className="flex flex-col h-[400px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedTicket.messages.map((m) => (
                  <div key={m.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-400">{m.user.name}</span>
                      <span>{new Date(m.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap">{m.content}</p>
                    {m.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {m.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={a.storagePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                          >
                            {a.filename}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-700/50 p-4">
                {selectedTicket.status === "rejected" && userId === selectedTicket.creator.id && (
                  <div className="mb-3">
                    <Button
                      variant="secondary"
                      onClick={() => { setShowResubmit(true); setResubmitSubject(selectedTicket.subject ?? ""); setResubmitContent(""); }}
                      className="gap-2 text-amber-400 hover:bg-amber-500/20"
                    >
                      <IconRefresh size={16} />
                      Editar e reenviar
                    </Button>
                  </div>
                )}
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Responder..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 mb-2"
                />
                <Button onClick={handleReply} disabled={loading || !replyContent.trim()} className="gap-2">
                  <IconSend size={16} />
                  Enviar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-[400px] flex-col items-center justify-center">
              <Button variant="secondary" onClick={() => setShowNew(true)} className="gap-2">
                <IconPlus size={16} />
                Novo Chamado
              </Button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
