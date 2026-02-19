"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type Tipo = {
  id: string;
  nome: string;
  group_id: string | null;
  group_nome: string | null;
  sector_id: string | null;
  sector_nome: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type Group = { id: string; name: string };
type Sector = { id: string; name: string; groupId: string };

export default function TiposSolicitacaoPage() {
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState("");
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [setores, setSetores] = useState<Group[]>([]);
  const [grupos, setGrupos] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tipo | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ nome: string; groupId: string; sectorId: string; status: string }>({
    nome: "",
    groupId: "",
    sectorId: "",
    status: "A",
  });

  const fetchClientes = useCallback(async () => {
    const res = await fetch("/api/admin/clientes");
    if (res.ok) {
      const data = await res.json();
      setClientes(data);
      if (data.length && !clientId) setClientId(data[0].id);
    }
  }, [clientId]);

  const fetchTipos = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(`/api/helpdesk/tipos?clientId=${clientId}`);
    if (res.ok) {
      const data = await res.json();
      setTipos(Array.isArray(data) ? data : []);
    } else setTipos([]);
  }, [clientId]);

  const fetchSetores = useCallback(async () => {
    if (!clientId) return;
    const res = await fetch(`/api/admin/grupos?clientId=${clientId}`);
    if (res.ok) {
      const data = await res.json();
      setSetores(Array.isArray(data) ? data : []);
    } else setSetores([]);
  }, [clientId]);

  const fetchGrupos = useCallback(async (groupId: string) => {
    if (!groupId) {
      setGrupos([]);
      return;
    }
    const res = await fetch(`/api/admin/setores?groupId=${groupId}`);
    if (res.ok) {
      const data = await res.json();
      setGrupos(Array.isArray(data) ? data : []);
    } else setGrupos([]);
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    if (clientes.length && !clientId) setClientId(clientes[0].id);
  }, [clientes, clientId]);

  useEffect(() => {
    if (clientId) {
      setLoading(true);
      Promise.all([fetchTipos(), fetchSetores()]).finally(() => setLoading(false));
    }
  }, [clientId, fetchTipos, fetchSetores]);

  useEffect(() => {
    if (form.groupId) fetchGrupos(form.groupId);
    else setGrupos([]);
  }, [form.groupId, fetchGrupos]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", groupId: "", sectorId: "", status: "A" });
    setModalOpen(true);
  };

  const openEdit = (t: Tipo) => {
    setEditing(t);
    setForm({
      nome: t.nome,
      groupId: t.group_id ?? "",
      sectorId: t.sector_id ?? "",
      status: t.status ?? "A",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientId,
        nome: form.nome.trim(),
        groupId: form.groupId || null,
        sectorId: form.sectorId || null,
        status: form.status,
      };
      if (editing) {
        const res = await fetch(`/api/helpdesk/tipos/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success("Tipo atualizado");
          setModalOpen(false);
          fetchTipos();
        } else toast.error(data.error ?? "Erro");
      } else {
        const res = await fetch("/api/helpdesk/tipos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success("Tipo criado");
          setModalOpen(false);
          fetchTipos();
        } else toast.error(data.error ?? "Erro");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (t: Tipo) => {
    if (!clientId) return;
    const newStatus = t.status === "A" ? "I" : "A";
    const res = await fetch(`/api/helpdesk/tipos/${t.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, status: newStatus }),
    });
    if (res.ok) {
      toast.success(newStatus === "A" ? "Tipo ativado" : "Tipo inativado");
      fetchTipos();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro");
    }
  };

  const handleDelete = async (t: Tipo) => {
    if (!clientId) return;
    if (!confirm(`Inativar "${t.nome}"?`)) return;
    const res = await fetch(`/api/helpdesk/tipos/${t.id}?clientId=${clientId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tipo inativado");
      fetchTipos();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Tipos de Solicitação</h1>
        <Button onClick={openCreate} className="gap-2" disabled={!clientId}>
          <IconPlus size={18} strokeWidth={2} /> Novo tipo
        </Button>
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-400 mb-1">Cliente</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
        >
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : tipos.length === 0 ? (
        <p className="text-zinc-500">Nenhum tipo. Clique em Novo tipo.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Nome</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Setor</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Grupo</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Status</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className="border-b border-zinc-700/30">
                  <td className="px-3 py-2.5 text-zinc-200">{t.nome}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{t.group_nome ?? "-"}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{t.sector_nome ?? "-"}</td>
                  <td className="px-3 py-2.5">{t.status === "A" ? <span className="text-emerald-400">Ativo</span> : <span className="text-zinc-500">Inativo</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(t)} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                      <button onClick={() => handleToggleStatus(t)} className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800" title={t.status === "A" ? "Inativar" : "Ativar"}>{t.status === "A" ? <IconX size={18} /> : <IconCheck size={18} />}</button>
                      <button onClick={() => handleDelete(t)} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar tipo" : "Novo tipo"} maxWidth="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              placeholder="Ex: FISCAL REGISTROS / NFE"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Setor</label>
            <select
              value={form.groupId}
              onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value, sectorId: "" }))}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Nenhum</option>
              {setores.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Grupo</label>
            <select
              value={form.sectorId}
              onChange={(e) => setForm((f) => ({ ...f, sectorId: e.target.value }))}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              disabled={!form.groupId}
            >
              <option value="">Nenhum</option>
              {grupos.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="A">Ativo</option>
              <option value="I">Inativo</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{editing ? "Salvar" : "Criar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
