"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EncaminharModal } from "./EncaminharModal";
import { IconChevronDown, IconChevronRight, IconPaperclip, IconPlayerPlay, IconSend } from "@tabler/icons-react";

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
    primaryGroup?: { name: string } | null;
    primarySector?: { name: string; group?: { name: string } } | null;
  } | null;
  group?: { id: string; name: string } | null;
  sector?: { id: string; name: string } | null;
  tipoSolicitacao?: { id: string; nome: string } | null;
  _count: { messages: number };
  updatedAt: string;
  createdAt: string;
  slaLimitHours?: number | null;
};

const PRIORITY_LABEL: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };

export function FilasPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [assumingId, setAssumingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<{ firstMessage?: string } | null>(null);
  const [ticketEmAtendimento, setTicketEmAtendimento] = useState<{
    id: string;
    numero?: number | null;
    messages: { id: string; content: string; user: { id: string; name: string }; attachments?: { id: string; filename: string; storagePath: string }[]; createdAt: string }[];
    subject: string | null;
    status: string;
    clientId?: string;
  } | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);
  const [showEncaminhar, setShowEncaminhar] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/helpdesk/tickets?view=filas");
      const data = await res.json();
      if (res.ok) setTickets(Array.isArray(data) ? data : []);
      else {
        if (res.status === 403) setTickets([]);
        else setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    const res = await fetch(`/api/helpdesk/tickets/${id}`);
    const data = await res.json();
    if (res.ok && data.messages?.length) {
      setExpandedDetail({ firstMessage: data.messages[0].content });
    } else {
      setExpandedDetail({});
    }
  }, [expandedId]);

  const fetchTicketDetail = useCallback(async (ticketId: string) => {
    const res = await fetch(`/api/helpdesk/tickets/${ticketId}`);
    const data = await res.json();
    if (res.ok) {
      setReplyFiles([]);
      setTicketEmAtendimento({
        id: data.id,
        numero: data.numero,
        messages: data.messages ?? [],
        subject: data.subject,
        status: data.status,
        clientId: data.client?.id,
      });
    }
  }, []);

  const assumir = async (id: string) => {
    setAssumingId(id);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${id}/assumir`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Chamado assumido");
        setExpandedId(null);
        setExpandedDetail(null);
        fetchTickets();
        await fetchTicketDetail(id);
      } else {
        toast.error(data.error ?? "Erro ao assumir");
      }
    } catch {
      toast.error("Erro ao assumir");
    } finally {
      setAssumingId(null);
    }
  };

  const handleReply = async () => {
    if (!ticketEmAtendimento || !replyContent.trim()) return;
    setReplyLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketEmAtendimento.id}/messages`, {
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
            formData.set("ticketId", ticketEmAtendimento.id);
            formData.set("messageId", messageId);
            formData.set("file", file);
            await fetch("/api/helpdesk/upload", { method: "POST", body: formData });
          }
          setReplyFiles([]);
        }
        setReplyContent("");
        await fetchTicketDetail(ticketEmAtendimento.id);
        fetchTickets();
      } else {
        toast.error(data.error ?? "Erro ao enviar");
      }
    } catch {
      toast.error("Erro ao enviar");
    } finally {
      setReplyLoading(false);
    }
  };

  const handleFinalizar = async () => {
    if (!ticketEmAtendimento) return;
    setReplyLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketEmAtendimento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "concluido" }),
      });
      if (res.ok) {
        toast.success("Chamado encerrado.");
        setTicketEmAtendimento(null);
        setReplyContent("");
        fetchTickets();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao finalizar");
      }
    } catch {
      toast.error("Erro ao finalizar");
    } finally {
      setReplyLoading(false);
    }
  };

  const areaLabel = (t: Ticket) =>
    t.group?.name ?? t.sector?.name ?? t.assigneeUser?.primaryGroup?.name ?? t.assigneeUser?.primarySector?.group?.name ?? "—";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">Filas de Chamados</h1>
        <p className="mt-1 text-sm text-zinc-500">Chamados aguardando atendimento na sua área. Clique em um para expandir e depois em Iniciar atendimento para assumir.</p>
      </header>

      {loading ? (
        <p className="text-zinc-500 text-sm py-4">Carregando...</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-8 text-center text-zinc-500">
          Nenhum chamado na fila no momento ou você não tem permissão para ver filas.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/50 bg-zinc-800/30">
                <th className="w-8 px-2 py-2" />
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Nº</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Assunto</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Área</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Cliente</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Prioridade</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <React.Fragment key={t.id}>
                  <tr
                    className="border-b border-zinc-700/30 hover:bg-zinc-800/30 cursor-pointer"
                    onClick={() => onExpand(t.id)}
                  >
                    <td className="w-8 px-2 py-2 text-zinc-500">
                      {expandedId === t.id ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">#{t.numero ?? t.id.slice(-8)}</td>
                    <td className="px-3 py-2.5 text-zinc-300 max-w-[200px] truncate">{t.subject || "—"}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{areaLabel(t)}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{t.tipoSolicitacao?.nome ?? "—"}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{t.client.name}</td>
                    <td className="px-3 py-2.5 text-xs">{t.priority ? PRIORITY_LABEL[t.priority] : "—"}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        className="gap-1"
                        disabled={assumingId === t.id}
                        onClick={() => assumir(t.id)}
                      >
                        <IconPlayerPlay size={14} />
                        Iniciar atendimento
                      </Button>
                    </td>
                  </tr>
                  {expandedId === t.id && (
                    <tr key={`${t.id}-exp`} className="border-b border-zinc-700/30 bg-zinc-800/20">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-zinc-500">Prioridade:</span>{" "}
                            {t.priority ? PRIORITY_LABEL[t.priority] : "—"}
                          </div>
                          <div>
                            <span className="text-zinc-500">Responsável atual:</span>{" "}
                            {t.assigneeUser?.name ?? "Não assumido"}
                          </div>
                          <div>
                            <span className="text-zinc-500">Tipo:</span> {t.tipoSolicitacao?.nome ?? "—"}
                          </div>
                          {(expandedDetail?.firstMessage ?? t.subject) && (
                            <div className="sm:col-span-2">
                              <span className="text-zinc-500">Assunto / Comentário inicial:</span>
                              <p className="mt-1 text-zinc-300 whitespace-pre-wrap rounded bg-zinc-900/50 p-2">
                                {expandedDetail?.firstMessage ?? t.subject ?? "—"}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ticketEmAtendimento && (
        <Modal
          isOpen={!!ticketEmAtendimento}
          onClose={() => { setTicketEmAtendimento(null); setReplyContent(""); }}
          title={`Chamado #${ticketEmAtendimento.numero ?? ticketEmAtendimento.id.slice(-8)} – Detalhes e interação`}
          maxWidth="lg"
        >
          <div className="flex flex-col max-h-[70vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 border-b border-zinc-700/50">
              {ticketEmAtendimento.messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-400">{m.user.name}</span>
                    <span>{new Date(m.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">{m.content}</p>
                  {(m.attachments?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(m.attachments ?? []).map((a) => (
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
                {ticketEmAtendimento.clientId && (
                  <Button variant="secondary" onClick={() => setShowEncaminhar(true)}>
                    Agendar / Encaminhar
                  </Button>
                )}
                {!["closed", "concluido"].includes(ticketEmAtendimento.status) && (
                  <Button variant="secondary" onClick={handleFinalizar} disabled={replyLoading} className="text-amber-400 hover:text-amber-300">
                    Finalizar chamado
                  </Button>
                )}
              </div>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Responder ao solicitante..."
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
                <Button variant="secondary" onClick={() => { setTicketEmAtendimento(null); setReplyContent(""); setReplyFiles([]); }}>
                  Fechar
                </Button>
                <Button onClick={handleReply} disabled={replyLoading || !replyContent.trim()} className="gap-2">
                  <IconSend size={16} />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showEncaminhar && ticketEmAtendimento?.clientId && (
        <EncaminharModal
          ticketId={ticketEmAtendimento.id}
          clientId={ticketEmAtendimento.clientId}
          onClose={() => setShowEncaminhar(false)}
          onSuccess={() => { fetchTicketDetail(ticketEmAtendimento.id); fetchTickets(); }}
        />
      )}
    </div>
  );
}
