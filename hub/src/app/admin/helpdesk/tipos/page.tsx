"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type Tipo = {
  id: string;
  nome: string;
  parent_id: string | null;
  parent_nome: string | null;
  status: string;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export default function TiposSolicitacaoPage() {
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [clientId, setClientId] = useState("");
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tipo | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ nome: string; parentId: string; ordem: number; status: string }>({
    nome: "",
    parentId: "",
    ordem: 0,
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

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    if (clientes.length && !clientId) setClientId(clientes[0].id);
  }, [clientes]);

  useEffect(() => {
    if (clientId) {
      setLoading(true);
      fetchTipos().finally(() => setLoading(false));
    }
  }, [clientId, fetchTipos]);

  function buildPath(id: string): string {
    const map = new Map(tipos.map((t) => [t.id, t]));
    const parts: string[] = [];
    let current: string | null = id;
    for (let i = 0; i < 50 && current; i++) {
      const t = map.get(current);
      if (!t) break;
      parts.unshift(t.nome);
      current = t.parent_id;
    }
    return parts.join(" > ") || "-";
  }

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: "", parentId: "", ordem: 0, status: "A" });
    setModalOpen(true);
  };

  const openEdit = (t: Tipo) => {
    setEditing(t);
    setForm({
      nome: t.nome,
      parentId: t.parent_id ?? "",
      ordem: t.ordem ?? 0,
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
      if (editing) {
        const res = await fetch(`/api/helpdesk/tipos/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            nome: form.nome.trim(),
            parentId: form.parentId || null,
            ordem: form.ordem,
            status: form.status,
          }),
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
          body: JSON.stringify({
            clientId,
            nome: form.nome.trim(),
            parentId: form.parentId || null,
            ordem: form.ordem,
            status: form.status,
          }),
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
    if (!confirm(`Inativar "${t.nome}"? (Não remove se tiver subcategorias.)`)) return;
    const res = await fetch(`/api/helpdesk/tipos/${t.id}?clientId=${clientId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Tipo inativado");
      fetchTipos();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro");
    }
  };

  const pathPreview = form.parentId
    ? (buildPath(form.parentId) + (form.nome.trim() ? " > " + form.nome.trim() : "")) || "-"
    : form.nome.trim() || "-";

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
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Pai</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Ordem</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Status</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Caminho</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className="border-b border-zinc-700/30">
                  <td className="px-3 py-2.5 text-zinc-200">{t.nome}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{t.parent_nome ?? "-"}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{t.ordem}</td>
                  <td className="px-3 py-2.5">{t.status === "A" ? <span className="text-emerald-400">Ativo</span> : <span className="text-zinc-500">Inativo</span>}</td>
                  <td className="px-3 py-2.5 text-zinc-500 text-xs max-w-[200px] truncate" title={buildPath(t.id)}>{buildPath(t.id)}</td>
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
            <label className="block text-sm font-medium text-zinc-400 mb-1">Pai</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Nenhum (raiz)</option>
              {tipos.filter((t) => !editing || t.id !== editing.id).map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Ordem</label>
            <input
              type="number"
              min={0}
              value={form.ordem}
              onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
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
          <div className="rounded-lg bg-zinc-800/50 px-3 py-2">
            <span className="text-xs text-zinc-500">Caminho: </span>
            <span className="text-sm text-zinc-300">{pathPreview}</span>
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
