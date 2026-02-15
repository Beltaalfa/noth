"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";

type Group = { id: string; name: string; clientId: string; client: { name: string } };

export default function GruposPage() {
  const [data, setData] = useState<Group[]>([]);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: "", clientId: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [gRes, cRes] = await Promise.all([fetch("/api/admin/grupos"), fetch("/api/admin/clientes")]);
    if (gRes.ok) setData(await gRes.json());
    if (cRes.ok) setClientes(await cRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", clientId: clientes[0]?.id ?? "" });
    setModalOpen(true);
  };

  const openEdit = (row: Group) => {
    setEditing(row);
    setForm({ name: row.name, clientId: row.clientId });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { alert("Selecione um cliente"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/grupos/${editing.id}` : "/api/admin/grupos";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setModalOpen(false); fetchData(); } else alert((await res.json()).error || "Erro");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: Group) => {
    if (!confirm(`Excluir grupo "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/grupos/${row.id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Grupos</h1>
        <Button onClick={openCreate} className="gap-2" disabled={clientes.length === 0}>
          <IconPlus size={18} strokeWidth={2} /> Novo grupo
        </Button>
      </div>
      {loading ? <p className="text-zinc-500">Carregando...</p> : (
        <Table<Group>
          columns={[
            { key: "name", header: "Nome" },
            { key: "client", header: "Cliente", render: (r) => r.client?.name ?? "-" },
            { key: "actions", header: "Ações", render: (r) => (
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
              </div>
            ) },
          ]}
          data={data}
          keyExtractor={(r) => r.id}
          emptyMessage="Nenhum grupo. Cadastre clientes primeiro."
        />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar grupo" : "Novo grupo"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Cliente</label>
            <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} required className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="">Selecione</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={saving}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
