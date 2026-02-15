"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconTools } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";

type Cliente = { id: string; name: string; status: string };

function FerramentasModal({ cliente, onClose, onUpdate }: { cliente: Cliente; onClose: () => void; onUpdate: () => void }) {
  const [clientTools, setClientTools] = useState<{ id: string; clientId: string; toolId: string; tool: { name: string; slug: string } }[]>([]);
  const [tools, setTools] = useState<{ id: string; name: string; slug: string; clientId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selTool, setSelTool] = useState("");

  const fetchData = useCallback(async () => {
    const [pRes, tRes] = await Promise.all([fetch("/api/admin/permissoes"), fetch("/api/admin/tools")]);
    if (pRes.ok) setClientTools((await pRes.json()).clientTools ?? []);
    if (tRes.ok) setTools(await tRes.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().then(() => setLoading(false));
  }, [fetchData]);

  const assigned = clientTools.filter((ct) => ct.clientId === cliente.id);
  const availableTools = tools.filter((t) => t.clientId === cliente.id && !assigned.some((a) => a.toolId === t.id));

  const addTool = async () => {
    if (!selTool) return;
    const res = await fetch("/api/admin/permissoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clientTool", clientId: cliente.id, toolId: selTool }),
    });
    if (res.ok) { setSelTool(""); fetchData(); onUpdate(); } else alert((await res.json()).error || "Erro");
  };

  const removeTool = async (id: string) => {
    if (!confirm("Remover ferramenta?")) return;
    const res = await fetch("/api/admin/permissoes/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clientTool", id }),
    });
    if (res.ok) { fetchData(); onUpdate(); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Ferramentas - ${cliente.name}`} maxWidth="md">
      {loading ? (
        <p className="text-zinc-500 py-4">Carregando...</p>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Ferramentas deste cliente</h3>
            <div className="flex gap-2 mb-2">
              <select value={selTool} onChange={(e) => setSelTool(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione uma ferramenta</option>
                {availableTools.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                ))}
              </select>
              <Button variant="secondary" onClick={addTool} disabled={!selTool}>Adicionar</Button>
            </div>
            <ul className="space-y-1">
              {assigned.map((ct) => (
                <li key={ct.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50 text-sm">
                  <span>{ct.tool.name} ({ct.tool.slug})</span>
                  <button type="button" onClick={() => removeTool(ct.id)} className="p-1.5 text-zinc-400 hover:text-red-400"><IconTrash size={14} strokeWidth={2} /></button>
                </li>
              ))}
            </ul>
            {assigned.length === 0 && <p className="text-zinc-500 text-sm py-2">Nenhuma ferramenta vinculada</p>}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ClientesPage() {
  const [data, setData] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ferramentasModal, setFerramentasModal] = useState<Cliente | null>(null);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ name: "", status: "active" as "active" | "inactive" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/clientes");
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", status: "active" });
    setModalOpen(true);
  };

  const openEdit = (row: Cliente) => {
    setEditing(row);
    setForm({ name: row.name, status: row.status as "active" | "inactive" });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/clientes/${editing.id}` : "/api/admin/clientes";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Cliente) => {
    if (!confirm(`Excluir cliente "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/clientes/${row.id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Clientes</h1>
        <Button onClick={openCreate} className="gap-2">
          <IconPlus size={18} strokeWidth={2} />
          Novo cliente
        </Button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : (
        <Table<Cliente>
          columns={[
            { key: "name", header: "Nome" },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <span className={r.status === "active" ? "text-green-400" : "text-zinc-500"}>
                  {r.status === "active" ? "Ativo" : "Inativo"}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Ações",
              render: (r) => (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setFerramentasModal(r); }}
                    className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                    title="Ferramentas"
                  >
                    <IconTools size={18} strokeWidth={2} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                    className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800"
                    title="Editar"
                  >
                    <IconPencil size={18} strokeWidth={2} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                    className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                    title="Excluir"
                  >
                    <IconTrash size={18} strokeWidth={2} />
                  </button>
                </div>
              ),
            },
          ]}
          data={data}
          keyExtractor={(r) => r.id}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar cliente" : "Novo cliente"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" }))}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      {ferramentasModal && (
        <FerramentasModal
          cliente={ferramentasModal}
          onClose={() => setFerramentasModal(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
