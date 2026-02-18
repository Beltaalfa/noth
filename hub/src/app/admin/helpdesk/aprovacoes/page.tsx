"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type Config = {
  id: string;
  groupId: string | null;
  sectorId: string | null;
  tipoSolicitacaoId: string | null;
  exigeAprovacao: boolean;
  tipoAprovacao: "hierarchical" | "by_level";
  group: { id: string; name: string } | null;
  sector: { id: string; name: string } | null;
  tipoSolicitacao: { id: string; nome: string } | null;
  approvers: { id: string; userId: string; ordem: number | null; nivel: number | null; user: { id: string; name: string } }[];
};

type Destinatarios = {
  users: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  sectors: { id: string; name: string }[];
};

export default function AprovacoesPage() {
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState("");
  const [configs, setConfigs] = useState<Config[]>([]);
  const [destinatarios, setDestinatarios] = useState<Destinatarios | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    groupId: string;
    sectorId: string;
    tipoSolicitacaoId: string;
    exigeAprovacao: boolean;
    tipoAprovacao: "hierarchical" | "by_level";
    approvers: { userId: string; ordem: number; nivel: number }[];
  }>({
    groupId: "",
    sectorId: "",
    tipoSolicitacaoId: "",
    exigeAprovacao: true,
    tipoAprovacao: "by_level",
    approvers: [],
  });
  const [tiposSolicitacao, setTiposSolicitacao] = useState<{ id: string; nome: string; sector_id?: string | null }[]>([]);

  const fetchClientes = useCallback(async () => {
    const res = await fetch("/api/admin/clientes");
    if (res.ok) {
      const data = await res.json();
      setClientes(data);
      if (data.length && !clientId) setClientId(data[0].id);
    }
  }, [clientId]);

  const fetchConfigs = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(`/api/helpdesk/approval-config?clientId=${clientId}`);
    if (res.ok) {
      const data = await res.json();
      setConfigs(Array.isArray(data) ? data : []);
    } else setConfigs([]);
  }, [clientId]);

  const fetchDestinatarios = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(`/api/helpdesk/destinatarios?clientId=${clientId}`);
    if (res.ok) {
      const d = await res.json();
      setDestinatarios({ users: d.users ?? [], groups: d.groups ?? [], sectors: d.sectors ?? [] });
    } else setDestinatarios(null);
  }, [clientId]);

  const fetchTiposSolicitacao = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(`/api/helpdesk/tipos?clientId=${clientId}`);
    if (res.ok) {
      const data = await res.json();
      setTiposSolicitacao(Array.isArray(data) ? data.filter((t: { status?: string }) => t.status === "A") : []);
    } else setTiposSolicitacao([]);
  }, [clientId]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    if (clientes.length) setClientId(clientes[0].id);
  }, [clientes]);

  useEffect(() => {
    if (clientId) {
      setLoading(true);
      Promise.all([fetchConfigs(), fetchDestinatarios(), fetchTiposSolicitacao()]).finally(() => setLoading(false));
    }
  }, [clientId, fetchConfigs, fetchDestinatarios, fetchTiposSolicitacao]);

  const openCreate = () => {
    setEditing(null);
    setForm({ groupId: "", sectorId: "", tipoSolicitacaoId: "", exigeAprovacao: true, tipoAprovacao: "by_level", approvers: [] });
    setModalOpen(true);
  };

  const openEdit = (c: Config) => {
    setEditing(c);
    setForm({
      groupId: c.groupId ?? "",
      sectorId: c.sectorId ?? "",
      tipoSolicitacaoId: c.tipoSolicitacaoId ?? "",
      exigeAprovacao: c.exigeAprovacao,
      tipoAprovacao: c.tipoAprovacao,
      approvers: (c.approvers ?? []).map((a) => ({ userId: a.userId, ordem: a.ordem ?? 1, nivel: a.nivel ?? 1 })),
    });
    setModalOpen(true);
  };

  const addApprover = () => {
    setForm((f) => ({ ...f, approvers: [...f.approvers, { userId: destinatarios?.users[0]?.id ?? "", ordem: 1, nivel: 1 }] }));
  };

  const removeApprover = (i: number) => {
    setForm((f) => ({ ...f, approvers: f.approvers.filter((_, idx) => idx !== i) }));
  };

  const updateApprover = (i: number, field: "userId" | "ordem" | "nivel", value: string | number) => {
    setForm((f) => ({
      ...f,
      approvers: f.approvers.map((a, idx) =>
        idx === i ? { ...a, [field]: typeof value === "string" ? value : Number(value) || 0 } : a
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    const hasGroup = !!form.groupId;
    const hasSector = !!form.sectorId;
    if (hasGroup === hasSector) { toast.error("Informe Setor (todos os tipos) OU Grupo (um tipo)"); return; }
    if (hasSector && !form.tipoSolicitacaoId) { toast.error("Para Grupo, selecione o tipo de solicitação"); return; }
    setSaving(true);
    try {
      const payload = {
        clientId,
        ...(form.groupId ? { groupId: form.groupId } : { sectorId: form.sectorId, tipoSolicitacaoId: form.tipoSolicitacaoId || null }),
        exigeAprovacao: form.exigeAprovacao,
        tipoAprovacao: form.tipoAprovacao,
        approvers: form.approvers.map((a) => ({ userId: a.userId, ordem: a.ordem, nivel: a.nivel })),
      };
      if (editing) {
        const res = await fetch(`/api/helpdesk/approval-config/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exigeAprovacao: form.exigeAprovacao,
            tipoAprovacao: form.tipoAprovacao,
            tipoSolicitacaoId: form.sectorId ? (form.tipoSolicitacaoId || null) : null,
            approvers: form.approvers.map((a) => ({ userId: a.userId, ordem: a.ordem, nivel: a.nivel })),
          }),
        });
        const data = await res.json();
        if (res.ok) { toast.success("Configuração atualizada"); setModalOpen(false); fetchConfigs(); }
        else toast.error(data.error ?? "Erro");
      } else {
        const res = await fetch("/api/helpdesk/approval-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) { toast.success("Configuração criada"); setModalOpen(false); fetchConfigs(); }
        else toast.error(data.error ?? "Erro");
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (c: Config) => {
    const label = c.group?.name ?? c.sector?.name ?? "esta configuração";
    if (!confirm(`Excluir configuração de "${label}"?`)) return;
    const res = await fetch(`/api/helpdesk/approval-config/${c.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Configuração excluída"); fetchConfigs(); }
    else toast.error("Erro ao excluir");
  };

  const getLabel = (c: Config) => c.group?.name ?? c.sector?.name ?? "-";
  const getScopeLabel = (c: Config) => (c.groupId ? "Setor (todos os tipos)" : (c.tipoSolicitacao?.nome ? `Grupo — ${c.tipoSolicitacao.nome}` : "Grupo — 1 tipo"));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Aprovações Helpdesk</h1>
        <Button onClick={openCreate} className="gap-2" disabled={!clientId || !destinatarios}>
          <IconPlus size={18} strokeWidth={2} /> Nova configuração
        </Button>
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-1">Cliente</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full max-w-xs rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100">
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {loading ? <p className="text-zinc-500">Carregando...</p> : configs.length === 0 ? (
        <p className="text-zinc-500">Nenhuma configuração. Clique em Nova configuração.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Destino (Setor/Grupo)</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Escopo</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Exige aprovação</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Tipo aprovação</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Aprovadores</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-zinc-700/30">
                  <td className="px-3 py-2.5 text-zinc-200">{getLabel(c)}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{getScopeLabel(c)}</td>
                  <td className="px-3 py-2.5">{c.exigeAprovacao ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{c.tipoAprovacao === "hierarchical" ? "Hierárquica" : "Por nível"}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{(c.approvers ?? []).map((a) => a.user?.name ?? a.userId).join(", ") || "-"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(c)} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                      <button onClick={() => handleDelete(c)} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar configuração" : "Nova configuração"} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-zinc-400 bg-zinc-800/50 rounded-lg px-3 py-2">
            <strong>Setor</strong>: o aprovador pode aprovar todos os tipos de solicitação daquele setor. <strong>Grupo</strong>: o aprovador pode aprovar apenas um tipo de solicitação daquele grupo. Escolha um <strong>Setor</strong> ou um <strong>Grupo</strong>, marque &quot;Exige aprovação&quot; e liste os aprovadores.
          </p>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Destino (Setor ou Grupo)</label>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-zinc-500">Setor — aprova todos os tipos</label>
                <select value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value, sectorId: "", tipoSolicitacaoId: "" }))} className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100" disabled={!!editing}>
                  <option value="">Nenhum</option>
                  {(destinatarios?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-500">Grupo — aprova apenas 1 tipo</label>
                <select value={form.sectorId} onChange={(e) => setForm((f) => ({ ...f, sectorId: e.target.value, groupId: "", tipoSolicitacaoId: "" }))} className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100" disabled={!!editing}>
                  <option value="">Nenhum</option>
                  {(destinatarios?.sectors ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          {form.sectorId && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Tipo de solicitação (obrigatório para Grupo)</label>
              <select value={form.tipoSolicitacaoId} onChange={(e) => setForm((f) => ({ ...f, tipoSolicitacaoId: e.target.value }))} className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100" required={!!form.sectorId} disabled={!!editing}>
                <option value="">Selecione o tipo</option>
                {tiposSolicitacao.filter((t) => t.sector_id === form.sectorId).length > 0
                  ? tiposSolicitacao.filter((t) => t.sector_id === form.sectorId).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)
                  : tiposSolicitacao.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="exige" checked={form.exigeAprovacao} onChange={(e) => setForm((f) => ({ ...f, exigeAprovacao: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800" />
            <label htmlFor="exige" className="text-sm text-zinc-300">Exige aprovação</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Tipo de aprovação</label>
            <select value={form.tipoAprovacao} onChange={(e) => setForm((f) => ({ ...f, tipoAprovacao: e.target.value as "hierarchical" | "by_level" }))} className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100">
              <option value="hierarchical">Hierárquica — aprovação em cadeia (chefe depois subordinado)</option>
              <option value="by_level">Por nível — aprovadores em níveis (nível 1, depois nível 2...)</option>
            </select>
          </div>
          <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-sm font-medium text-zinc-300">Quem pode aprovar</label>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Adicione as pessoas que podem aprovar tickets deste grupo/setor. Qualquer um da lista pode aprovar. Ordem e Nível são opcionais (para fluxos com múltiplas etapas).
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={addApprover} className="px-2 py-1 text-xs shrink-0">+ Adicionar</Button>
            </div>
            <div className="space-y-2 mt-3">
              {form.approvers.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-zinc-500 block mb-0.5">Aprovador {i + 1}</span>
                    <select value={a.userId} onChange={(e) => updateApprover(i, "userId", e.target.value)} className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-2 py-1.5 text-sm text-zinc-100">
                      {(destinatarios?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <div className="w-16">
                      <span className="text-xs text-zinc-500 block mb-0.5">Ordem</span>
                      <input type="number" min={1} value={a.ordem} onChange={(e) => updateApprover(i, "ordem", e.target.value)} title="Ordem na lista (1 = primeiro)" className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-2 py-1.5 text-sm text-zinc-100" />
                    </div>
                    <div className="w-16">
                      <span className="text-xs text-zinc-500 block mb-0.5">Nível</span>
                      <input type="number" min={1} value={a.nivel} onChange={(e) => updateApprover(i, "nivel", e.target.value)} title="Nível de aprovação (para fluxo por nível)" className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-2 py-1.5 text-sm text-zinc-100" />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeApprover(i)} className="p-2 text-red-400 hover:bg-red-500/20 rounded shrink-0 mt-4" title="Remover aprovador">✕</button>
                </div>
              ))}
            </div>
            {form.approvers.length === 0 && (
              <p className="text-sm text-zinc-500 italic mt-2">Nenhum aprovador. Clique em + Adicionar.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
