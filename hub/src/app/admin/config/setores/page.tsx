"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

type Sector = { id: string; name: string; groupId: string; group: { name: string; client?: { name: string } } };

export default function SetoresPage() {
  const [data, setData] = useState<Sector[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [grupos, setGrupos] = useState<{ id: string; name: string; clientId: string; client?: { name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [form, setForm] = useState({ name: "", groupId: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sRes, gRes] = await Promise.all([
      fetch(`/api/admin/setores?page=${page}&limit=${pageSize}`),
      fetch("/api/admin/grupos"),
    ]);
    if (sRes.ok) {
      const json = await sRes.json();
      setData(json.data ?? json);
      setTotal(json.total ?? json.data?.length ?? json.length ?? 0);
    }
    if (gRes.ok) setGrupos(await gRes.json());
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", groupId: grupos[0]?.id ?? "" });
    setModalOpen(true);
  };

  const openEdit = (row: Sector) => {
    setEditing(row);
    setForm({ name: row.name, groupId: row.groupId });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupId) { toast.error("Selecione um setor"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/setores/${editing.id}` : "/api/admin/setores";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { toast.success(editing ? "Grupo atualizado!" : "Grupo criado!"); setModalOpen(false); fetchData(); } else toast.error((await res.json()).error || "Erro");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: Sector) => {
    if (!confirm(`Excluir grupo "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/setores/${row.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Grupo excluído"); fetchData(); } else toast.error("Erro ao excluir");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Grupos</h1>
        <Button onClick={openCreate} className="gap-2" disabled={grupos.length === 0}>
          <IconPlus size={18} strokeWidth={2} /> Novo grupo
        </Button>
      </div>
      {loading ? <p className="text-zinc-500">Carregando...</p> : (
        <Table<Sector>
          columns={[
            { key: "group", header: "Setor", render: (r) => r.group?.name ?? "-" },
            { key: "name", header: "Nome" },
            { key: "actions", header: "Ações", render: (r) => (
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
              </div>
            ) },
          ]}
          data={data}
          keyExtractor={(r) => r.id}
          emptyMessage="Nenhum grupo. Cadastre setores primeiro."
        />
      )}
      {total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar grupo" : "Novo grupo"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Setor</label>
            <select value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))} required className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="">Selecione um setor</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.name}{g.client ? ` (${g.client.name})` : ""}</option>
              ))}
            </select>
          </div>
          {form.groupId && (
            <p className="text-sm text-zinc-400">
              Cliente: {grupos.find((g) => g.id === form.groupId)?.client?.name ?? "-"}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={saving}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
