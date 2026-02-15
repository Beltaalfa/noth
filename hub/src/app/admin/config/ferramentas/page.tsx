"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";

type Tool = {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  description?: string;
  dbConnectionId?: string | null;
  client: { name: string };
};

export default function FerramentasPage() {
  const [data, setData] = useState<Tool[]>([]);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [conexoes, setConexoes] = useState<{ id: string; clientId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    name: "",
    slug: "",
    description: "",
    type: "report" as "report" | "integration" | "query_runner" | "app",
    status: "active" as "active" | "inactive",
    dbConnectionId: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tRes, cRes, connRes] = await Promise.all([
      fetch("/api/admin/tools"),
      fetch("/api/admin/clientes"),
      fetch("/api/admin/conexoes"),
    ]);
    if (tRes.ok) setData(await tRes.json());
    if (cRes.ok) setClientes(await cRes.json());
    if (connRes.ok) setConexoes(await connRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      clientId: clientes[0]?.id ?? "",
      name: "",
      slug: "",
      description: "",
      type: "report",
      status: "active",
      dbConnectionId: "",
    });
    setModalOpen(true);
  };

  const openEdit = (row: Tool) => {
    setEditing(row);
    setForm({
      clientId: row.clientId ?? "",
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      type: (row.type || "report") as "report" | "integration" | "query_runner" | "app",
      status: (row.status || "active") as "active" | "inactive",
      dbConnectionId: row.dbConnectionId ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.name || !form.slug) { alert("Preencha os campos obrigatórios"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/tools/${editing.id}` : "/api/admin/tools";
      const method = editing ? "PATCH" : "POST";
      const body = { ...form, dbConnectionId: form.dbConnectionId || undefined };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setModalOpen(false); fetchData(); } else alert((await res.json()).error || "Erro");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: Tool) => {
    if (!confirm(`Excluir ferramenta "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/tools/${row.id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const conexoesDoCliente = form.clientId ? conexoes.filter((c) => (c as { clientId?: string }).clientId === form.clientId) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Ferramentas</h1>
        <Button onClick={openCreate} className="gap-2" disabled={clientes.length === 0}>
          <IconPlus size={18} strokeWidth={2} /> Nova ferramenta
        </Button>
      </div>
      {loading ? <p className="text-zinc-500">Carregando...</p> : (
        <Table<Tool>
          columns={[
            { key: "name", header: "Nome" },
            { key: "slug", header: "Slug" },
            { key: "type", header: "Tipo" },
            { key: "client", header: "Cliente", render: (r) => r.client?.name ?? "-" },
            { key: "status", header: "Status", render: (r) => <span className={r.status === "active" ? "text-green-400" : "text-zinc-500"}>{r.status === "active" ? "Ativo" : "Inativo"}</span> },
            {
              key: "actions",
              header: "Ações",
              render: (r) => (
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
                </div>
              ),
            },
          ]}
          data={data}
          keyExtractor={(r) => r.id}
          emptyMessage="Nenhuma ferramenta. Cadastre clientes primeiro."
        />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar ferramenta" : "Nova ferramenta"} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Cliente</label>
            <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} required className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="">Selecione</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: !editing ? e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : f.slug }))} required />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="nome-ferramenta" required />
          <Input label="Descrição" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Tipo</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="report">Relatório</option>
              <option value="integration">Integração</option>
              <option value="query_runner">Query Runner</option>
              <option value="app">App</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Conexão de Banco (opcional)</label>
            <select value={form.dbConnectionId} onChange={(e) => setForm((f) => ({ ...f, dbConnectionId: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="">Nenhuma</option>
              {conexoesDoCliente.map((c) => <option key={c.id} value={c.id}>Conexão {c.id.slice(0, 8)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
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
