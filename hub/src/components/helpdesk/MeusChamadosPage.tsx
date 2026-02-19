"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { IconPlus, IconPaperclip, IconSend } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EncaminharModal } from "./EncaminharModal";
import { TIPO_CADASTRO_DESCONTO_COMERCIAL } from "@/lib/schemas/helpdesk";

type Cliente = { id: string; name: string };
type Ticket = {
  id: string;
  numero?: number | null;
  subject: string | null;
  status: string;
  priority?: string | null;
  creator: { id: string; name: string };
  client: { id: string; name: string };
  assigneeUser?: {
    id: string;
    name: string;
    primaryGroup?: { id: string; name: string } | null;
    primarySector?: { id: string; name: string; group?: { name: string } } | null;
  } | null;
  group?: { id: string; name: string } | null;
  sector?: { id: string; name: string } | null;
  tipoSolicitacao?: { id: string; nome: string } | null;
  _count: { messages: number };
  updatedAt: string;
  createdAt: string;
  slaLimitHours?: number | null;
};
type Summary = {
  abertos?: number;
  emAndamento?: number;
  aguardandoAprovacao?: number;
  reprovados?: number;
  encerrados?: number;
  agendado?: number;
  aguardandoAtendimento?: number;
  emAtendimento?: number;
  aguardandoFeedback?: number;
  concluido?: number;
  custoAguardandoAprovacao?: number;
};
type Message = {
  id: string;
  content: string;
  user: { id: string; name: string };
  attachments: { id: string; filename: string; storagePath: string }[];
  createdAt: string;
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
  agendado_com_usuario: "Agendado",
  aguardando_atendimento: "Aguardando atendimento",
  em_atendimento: "Em atendimento",
  aguardando_feedback_usuario: "Aguardando seu feedback",
  encaminhado_operador: "Encaminhado",
  indisponivel_atendimento: "Indisponível",
  reaberto: "Reaberto",
  retornado_usuario: "Retornado",
  custo_aguardando_aprovacao: "Custo aguardando aprovação",
  autorizado: "Autorizado",
  negado: "Negado",
  atualizado: "Atualizado",
  concluido: "Concluído",
  aguardando_aprovacao_proprietarios: "Aguardando aprovação (2 proprietários)",
};
const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export function MeusChamadosPage({ clientes }: { clientes: Cliente[] }) {
  useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<{
    id: string;
    messages: Message[];
    subject: string | null;
    status: string;
    creator: { id: string };
    clientId?: string;
  } | null>(null);
  const [showEncaminhar, setShowEncaminhar] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(clientes[0]?.id ?? "");
  const [tabFilter, setTabFilter] = useState<"abertos" | "encerrados">("abertos");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketClientId, setNewTicketClientId] = useState(clientes[0]?.id ?? "");
  const [assigneeType, setAssigneeType] = useState<"user" | "group" | "sector">("group");
  const [assigneeId, setAssigneeId] = useState("");
  const [subject, setSubject] = useState("");
  const [newTicketContent, setNewTicketContent] = useState("");
  const [tipoSolicitacaoId, setTipoSolicitacaoId] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<string>("");
  const [destinatarios, setDestinatarios] = useState<{
    users: { id: string; name: string; type: string }[];
    groups: { id: string; name: string; type: string }[];
    sectors: { id: string; name: string; type: string }[];
  } | null>(null);
  type TipoSolicitacaoItem = { id: string; nome: string; parent_nome: string | null; group_id: string | null; sector_id: string | null };
  const [tiposSolicitacaoAll, setTiposSolicitacaoAll] = useState<TipoSolicitacaoItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [formDataCadastro, setFormDataCadastro] = useState({
    nome: "",
    cep: "",
    endereco: "",
    telefone: "",
    cpfCnpj: "",
    inscricaoEstadual: "",
    observacoes: "",
  });
  const [valorDesconto, setValorDesconto] = useState("");

  const fetchDestinatarios = useCallback(async (cid: string) => {
    if (!cid) return;
    const res = await fetch(`/api/helpdesk/destinatarios?clientId=${cid}&onlyReceivers=true`);
    const data = await res.json();
    if (res.ok) setDestinatarios(data);
    else setDestinatarios(null);
  }, []);

  const fetchTiposSolicitacao = useCallback(async (cid: string) => {
    if (!cid) return;
    const res = await fetch(`/api/helpdesk/tipos?clientId=${cid}`);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      const ativos = data
        .filter((t: { status?: string }) => t.status === "A")
        .map((t: { id: string; nome: string; parent_nome?: string | null; group_id?: string | null; sector_id?: string | null }) => ({
          id: t.id,
          nome: t.nome,
          parent_nome: t.parent_nome ?? null,
          group_id: t.group_id ?? null,
          sector_id: t.sector_id ?? null,
        }));
      setTiposSolicitacaoAll(ativos);
    } else {
      setTiposSolicitacaoAll([]);
    }
  }, []);

  useEffect(() => {
    if (showNewTicket && newTicketClientId) {
      fetchDestinatarios(newTicketClientId);
      fetchTiposSolicitacao(newTicketClientId);
    }
  }, [showNewTicket, newTicketClientId, fetchDestinatarios, fetchTiposSolicitacao]);

  const assigneeOptions = destinatarios
    ? [
        ...(destinatarios.users ?? []).map((u: { id: string; name: string; groupIds?: string[]; sectorIds?: string[] }) => ({
          id: u.id,
          name: u.name,
          type: "user" as const,
          groupIds: u.groupIds ?? [],
          sectorIds: u.sectorIds ?? [],
        })),
        ...(destinatarios.groups ?? []).map((g) => ({ id: g.id, name: g.name, type: "group" as const })),
        ...(destinatarios.sectors ?? []).map((s) => ({ id: s.id, name: s.name, type: "sector" as const })),
      ]
    : [];

  const selectedUserOption = assigneeType === "user" ? assigneeOptions.find((o) => o.type === "user" && o.id === assigneeId) : null;
  const userGroupIds = selectedUserOption && "groupIds" in selectedUserOption ? (selectedUserOption as { groupIds: string[] }).groupIds : [];
  const userSectorIds = selectedUserOption && "sectorIds" in selectedUserOption ? (selectedUserOption as { sectorIds: string[] }).sectorIds : [];

  const tiposSolicitacaoFiltered = (() => {
    if (!assigneeId) return [];
    if (assigneeType === "group") return tiposSolicitacaoAll.filter((t) => t.group_id === assigneeId);
    if (assigneeType === "sector") return tiposSolicitacaoAll.filter((t) => t.sector_id === assigneeId);
    if (assigneeType === "user")
      return tiposSolicitacaoAll.filter(
        (t) =>
          (!t.group_id && !t.sector_id) ||
          (t.group_id && userGroupIds.includes(t.group_id)) ||
          (t.sector_id && userSectorIds.includes(t.sector_id))
      );
    return [];
  })();

  useEffect(() => {
    if (!tipoSolicitacaoId) return;
    const allowed = tiposSolicitacaoFiltered.some((t) => t.id === tipoSolicitacaoId);
    if (!allowed) setTipoSolicitacaoId("");
  }, [assigneeType, assigneeId, tipoSolicitacaoId, tiposSolicitacaoFiltered]);

  const selectedTipoNome = tiposSolicitacaoFiltered.find((t) => t.id === tipoSolicitacaoId)?.nome ?? "";
  const isTipoCadastroDesconto = selectedTipoNome === TIPO_CADASTRO_DESCONTO_COMERCIAL;

  const handleCreateTicket = async () => {
    if (!newTicketClientId || !assigneeId || !newTicketContent.trim()) {
      toast.error("Preencha o destinatário e a mensagem.");
      return;
    }
    if (isTipoCadastroDesconto) {
      if (!formDataCadastro.nome.trim()) {
        toast.error("Preencha o nome (razão social ou nome completo).");
        return;
      }
      const valor = valorDesconto.replace(",", ".");
      const num = parseFloat(valor);
      if (valor === "" || Number.isNaN(num) || num < 0) {
        toast.error("Informe o valor do desconto em reais (ex.: 0,10 ou 0,20).");
        return;
      }
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        clientId: newTicketClientId,
        subject: subject.trim() || undefined,
        assigneeType,
        assigneeId,
        content: newTicketContent.trim(),
        tipoSolicitacaoId: tipoSolicitacaoId || undefined,
        priority: newTicketPriority || undefined,
      };
      if (isTipoCadastroDesconto) {
        body.formData = {
          nome: formDataCadastro.nome.trim(),
          cep: formDataCadastro.cep.trim() || undefined,
          endereco: formDataCadastro.endereco.trim() || undefined,
          telefone: formDataCadastro.telefone.trim() || undefined,
          cpfCnpj: formDataCadastro.cpfCnpj.trim() || undefined,
          inscricaoEstadual: formDataCadastro.inscricaoEstadual.trim() || undefined,
          observacoes: formDataCadastro.observacoes.trim() || undefined,
        };
        body.custoOrcamento = parseFloat(valorDesconto.replace(",", "."));
      }
      const res = await fetch("/api/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const ticketId = data.id as string;
        const firstMessage = Array.isArray(data.messages) ? data.messages[0] : null;
        const messageId = firstMessage?.id as string | undefined;
        if (messageId && newTicketFiles.length > 0) {
          for (const file of newTicketFiles) {
            const formData = new FormData();
            formData.append("ticketId", ticketId);
            formData.append("messageId", messageId);
            formData.append("file", file);
            const upRes = await fetch("/api/helpdesk/upload", { method: "POST", body: formData });
            if (!upRes.ok) {
              const err = await upRes.json().catch(() => ({}));
              toast.error(err.error ?? `Falha ao anexar ${file.name}`);
            }
          }
        }
        toast.success("Chamado criado.");
        setShowNewTicket(false);
        setSubject("");
        setNewTicketContent("");
        setAssigneeId("");
        setTipoSolicitacaoId("");
        setNewTicketPriority("");
        setNewTicketFiles([]);
        setFormDataCadastro({ nome: "", cep: "", endereco: "", telefone: "", cpfCnpj: "", inscricaoEstadual: "", observacoes: "" });
        setValorDesconto("");
        fetchTickets();
        fetchSummary();
      } else {
        toast.error(data.error ?? "Erro ao criar chamado");
      }
    } catch {
      toast.error("Erro ao criar chamado");
    } finally {
      setCreating(false);
    }
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ view: "meus_chamados" });
      if (clientId) q.set("clientId", clientId);
      const res = await fetch(`/api/helpdesk/tickets?${q}`);
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
    const q = new URLSearchParams({ view: "meus_chamados" });
    if (clientId) q.set("clientId", clientId);
    const res = await fetch(`/api/helpdesk/tickets/summary?${q}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
    else setSummary(null);
  }, [clientId]);

  const fetchTicket = useCallback(async (id: string) => {
    const res = await fetch(`/api/helpdesk/tickets/${id}`);
    const data = await res.json();
    if (res.ok) {
      setReplyFiles([]);
      setSelectedTicket({
        id: data.id,
        messages: data.messages ?? [],
        subject: data.subject,
        status: data.status,
        creator: { id: data.creator?.id ?? "" },
        clientId: data.client?.id,
      });
      await fetch("/api/helpdesk/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id }),
      });
    } else toast.error(data.error ?? "Erro ao carregar");
  }, []);

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
    if (showNewTicket) setNewTicketClientId((clientId || clientes[0]?.id) ?? "");
  }, [showNewTicket, clientId, clientes]);

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
        const messageId = data.id;
        if (messageId && replyFiles.length > 0) {
          for (const file of replyFiles) {
            const formData = new FormData();
            formData.set("ticketId", selectedTicket.id);
            formData.set("messageId", messageId);
            formData.set("file", file);
            await fetch("/api/helpdesk/upload", { method: "POST", body: formData });
          }
          setReplyFiles([]);
        }
        setReplyContent("");
        fetchTicket(selectedTicket.id);
        fetchTickets();
        fetchSummary();
      } else toast.error(data.error ?? "Erro ao enviar");
    } catch {
      toast.error("Erro ao enviar");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizar = async () => {
    if (!selectedTicket) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "concluido" }),
      });
      if (res.ok) {
        fetchTicket(selectedTicket.id);
        fetchTickets();
        fetchSummary();
        setSelectedTicket(null);
        toast.success("Chamado encerrado.");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao finalizar");
      }
    } catch {
      toast.error("Erro ao finalizar");
    } finally {
      setLoading(false);
    }
  };

  const isOpenStatus = (s: string) =>
    ["open", "in_progress", "pending_approval", "aguardando_atendimento", "em_atendimento", "aguardando_feedback_usuario", "agendado_com_usuario", "encaminhado_operador", "reaberto"].includes(s);
  const filtered = tickets.filter((t) =>
    tabFilter === "abertos" ? isOpenStatus(t.status) : ["closed", "concluido", "cancelled"].includes(t.status)
  );

  const areaLabel = (t: Ticket) =>
    t.group?.name ?? t.sector?.name ?? t.assigneeUser?.primaryGroup?.name ?? t.assigneeUser?.primarySector?.group?.name ?? "—";
  const departamentoLabel = (t: Ticket) =>
    t.sector?.name ?? t.group?.name ?? t.assigneeUser?.primarySector?.name ?? t.assigneeUser?.primaryGroup?.name ?? "—";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Meus Chamados</h1>
        <Button className="gap-2" onClick={() => setShowNewTicket(true)}>
          <IconPlus size={18} />
          Novo chamado
        </Button>
      </header>

      <Modal
        isOpen={showNewTicket}
        onClose={() => setShowNewTicket(false)}
        title="Novo Chamado"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {clientes.length > 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Cliente</label>
              <select
                value={newTicketClientId}
                onChange={(e) => {
                  setNewTicketClientId(e.target.value);
                  setAssigneeId("");
                }}
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
          {tiposSolicitacaoFiltered.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Tipo de Solicitação</label>
              <select
                value={tipoSolicitacaoId}
                onChange={(e) => {
                  setTipoSolicitacaoId(e.target.value);
                  if (tiposSolicitacaoFiltered.find((t) => t.id === e.target.value)?.nome !== TIPO_CADASTRO_DESCONTO_COMERCIAL) {
                    setFormDataCadastro({ nome: "", cep: "", endereco: "", telefone: "", cpfCnpj: "", inscricaoEstadual: "", observacoes: "" });
                    setValorDesconto("");
                  }
                }}
                className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Nenhum</option>
                {tiposSolicitacaoFiltered.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.parent_nome ? `${t.parent_nome} › ${t.nome}` : t.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isTipoCadastroDesconto && (
            <div className="space-y-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-4">
              <h3 className="text-sm font-semibold text-zinc-300">Dados para cadastro e desconto comercial</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="cadastro-nome" className="mb-1 block text-xs font-medium text-zinc-400">Nome (razão social ou nome completo) *</label>
                  <input
                    id="cadastro-nome"
                    value={formDataCadastro.nome}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, nome: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-cep" className="mb-1 block text-xs font-medium text-zinc-400">CEP</label>
                  <input
                    id="cadastro-cep"
                    value={formDataCadastro.cep}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, cep: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="CEP"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-telefone" className="mb-1 block text-xs font-medium text-zinc-400">Telefone</label>
                  <input
                    id="cadastro-telefone"
                    value={formDataCadastro.telefone}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, telefone: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Telefone"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cadastro-endereco" className="mb-1 block text-xs font-medium text-zinc-400">Endereço</label>
                  <input
                    id="cadastro-endereco"
                    value={formDataCadastro.endereco}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, endereco: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Endereço"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-cpfcnpj" className="mb-1 block text-xs font-medium text-zinc-400">CPF ou CNPJ</label>
                  <input
                    id="cadastro-cpfcnpj"
                    value={formDataCadastro.cpfCnpj}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, cpfCnpj: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="CPF ou CNPJ"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-ie" className="mb-1 block text-xs font-medium text-zinc-400">Inscrição estadual (ou ORG)</label>
                  <input
                    id="cadastro-ie"
                    value={formDataCadastro.inscricaoEstadual}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, inscricaoEstadual: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="IE ou ORG"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cadastro-observacoes" className="mb-1 block text-xs font-medium text-zinc-400">Volume, combustível, observações</label>
                  <input
                    id="cadastro-observacoes"
                    value={formDataCadastro.observacoes}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, observacoes: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Volume que abastece, combustível, observações"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-valor-desconto" className="mb-1 block text-xs font-medium text-zinc-400">Valor do desconto (R$) *</label>
                  <input
                    id="cadastro-valor-desconto"
                    type="text"
                    inputMode="decimal"
                    value={valorDesconto}
                    onChange={(e) => setValorDesconto(e.target.value)}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Ex.: 0,10 ou 0,20"
                  />
                </div>
              </div>
            </div>
          )}
          <div>
            <label htmlFor="new-ticket-priority" className="mb-1.5 block text-sm font-medium text-zinc-400">Prioridade</label>
            <select
              id="new-ticket-priority"
              value={newTicketPriority}
              onChange={(e) => setNewTicketPriority(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              aria-label="Prioridade do chamado"
            >
              <option value="">Nenhuma</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <label htmlFor="new-ticket-subject" className="mb-1.5 block text-sm font-medium text-zinc-400">Assunto</label>
            <input
              id="new-ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Assunto do chamado"
              aria-label="Assunto do chamado"
            />
          </div>
          <div>
            <label htmlFor="new-ticket-message" className="mb-1.5 block text-sm font-medium text-zinc-400">Mensagem</label>
            <textarea
              id="new-ticket-message"
              value={newTicketContent}
              onChange={(e) => setNewTicketContent(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Descreva aqui o seu chamado"
              aria-label="Mensagem do chamado"
            />
          </div>
          <div>
            <label htmlFor="new-ticket-attachments" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <IconPaperclip size={16} />
              Anexar documentos
            </label>
            <input
              id="new-ticket-attachments"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="mt-1 block w-full text-sm text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-zinc-200 file:hover:bg-zinc-600"
              onChange={(e) => setNewTicketFiles(Array.from(e.target.files ?? []))}
              aria-label="Anexar documentos ao chamado"
            />
            {newTicketFiles.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                {newTicketFiles.map((f, i) => (
                  <li key={i} className="rounded bg-zinc-800/50 px-2 py-1">
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
            <Button variant="secondary" onClick={() => { setShowNewTicket(false); setNewTicketFiles([]); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTicket} disabled={creating}>
              Criar Chamado
            </Button>
          </div>
        </div>
      </Modal>

      {summary && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
          <button
            type="button"
            onClick={() => setTabFilter("abertos")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
              {(summary.abertos ?? 0) + (summary.aguardandoAtendimento ?? 0) + (summary.agendado ?? 0)}
            </span>
            Abertos / Aguardando
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("abertos")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">{summary.emAtendimento ?? summary.emAndamento ?? 0}</span>
            Em atendimento
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("abertos")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">{summary.aguardandoFeedback ?? 0}</span>
            Aguardando feedback
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("encerrados")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-zinc-600/50 px-2 py-0.5 text-xs text-zinc-400">{summary.concluido ?? summary.encerrados ?? 0}</span>
            Encerrados
          </button>
        </div>
      )}

      {clientes.length > 1 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4 max-w-xs">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Cliente</label>
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

      <div className="flex gap-1 border-b border-zinc-700/50">
        <button
          type="button"
          onClick={() => setTabFilter("abertos")}
          className={`px-4 py-2 text-sm font-medium ${tabFilter === "abertos" ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Abertos
        </button>
        <button
          type="button"
          onClick={() => setTabFilter("encerrados")}
          className={`px-4 py-2 text-sm font-medium ${tabFilter === "encerrados" ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Encerrados
        </button>
      </div>

      <div>
          {loading ? (
            <p className="text-zinc-500 text-sm py-4">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm py-4">Nenhum chamado nesta aba.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700/50">
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Nº</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Área</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Depto</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => fetchTicket(t.id)}
                      className={`border-b border-zinc-700/30 cursor-pointer transition-colors hover:bg-zinc-800/30 ${selectedTicket?.id === t.id ? "bg-zinc-800/50" : ""}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">#{t.numero ?? t.id.slice(-8)}</td>
                      <td className="px-3 py-2.5 text-zinc-300 max-w-[100px] truncate">{areaLabel(t)}</td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[100px] truncate">{t.tipoSolicitacao?.nome ?? "—"}</td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[100px] truncate">{t.client.name}</td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[80px] truncate">{departamentoLabel(t)}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-zinc-700/50 text-zinc-300">
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500">{t.priority ? (PRIORITY_LABEL[t.priority] ?? t.priority) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {selectedTicket && (
        <Modal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`Chamado #${tickets.find((t) => t.id === selectedTicket.id)?.numero ?? selectedTicket.id.slice(-8)}`}
          maxWidth="lg"
        >
          <div className="flex flex-col max-h-[70vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 border-b border-zinc-700/50">
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
                        <a key={a.id} href={a.storagePath} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                          {a.filename}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedTicket.clientId && (
                  <Button variant="secondary" onClick={() => setShowEncaminhar(true)}>
                    Agendar / Encaminhar
                  </Button>
                )}
                {!["closed", "concluido"].includes(selectedTicket.status) && (
                  <Button variant="secondary" onClick={handleFinalizar} disabled={loading} className="text-amber-400 hover:text-amber-300">
                    Finalizar chamado
                  </Button>
                )}
              </div>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Responder..."
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 mb-2"
              />
              <div className="mb-2">
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <IconPaperclip size={16} />
                  <span>Anexar arquivos à resposta</span>
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => setReplyFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                  />
                </label>
                {replyFiles.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {replyFiles.map((f, i) => (
                      <li key={i} className="rounded bg-zinc-800/50 px-2 py-1 flex items-center gap-1">
                        {f.name} ({(f.size / 1024).toFixed(1)} KB)
                        <button type="button" onClick={() => setReplyFiles((p) => p.filter((_, j) => j !== i))} className="text-red-400 hover:underline">remover</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setSelectedTicket(null)}>
                  Fechar
                </Button>
                <Button onClick={() => { handleReply(); }} disabled={loading || !replyContent.trim()} className="gap-2">
                  <IconSend size={16} />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showEncaminhar && selectedTicket?.clientId && (
        <EncaminharModal
          ticketId={selectedTicket.id}
          clientId={selectedTicket.clientId}
          onClose={() => setShowEncaminhar(false)}
          onSuccess={() => { fetchTicket(selectedTicket.id); fetchTickets(); fetchSummary(); }}
        />
      )}
    </div>
  );
}
