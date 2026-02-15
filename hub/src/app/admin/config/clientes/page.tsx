"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconUpload } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

type Cliente = { id: string; name: string; logoUrl?: string | null; status: string };

export default function ClientesPage() {
  const [data, setData] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ name: "", logoUrl: "", status: "active" as "active" | "inactive" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/clientes?page=${page}&limit=${pageSize}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data ?? json);
      setTotal(json.total ?? json.data?.length ?? json.length ?? 0);
    }
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", logoUrl: "", status: "active" });
    setLogoFile(null);
    setModalOpen(true);
  };

  const openEdit = (row: Cliente) => {
    setEditing(row);
    setForm({ name: row.name, logoUrl: row.logoUrl ?? "", status: row.status as "active" | "inactive" });
    setLogoFile(null);
    setModalOpen(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/svg+xml"].includes(f.type)) {
      toast.error("Formato inválido. Use PNG, JPEG ou SVG.");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }
    setLogoFile(f);
    setForm((prev) => ({ ...prev, logoUrl: f.name }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let logoPath = editing?.logoUrl ?? null;
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        const upRes = await fetch("/api/admin/upload/logo", {
          method: "POST",
          body: formData,
        });
        if (!upRes.ok) {
          const err = await upRes.json();
          toast.error(err.error || "Erro ao fazer upload da logo");
          return;
        }
        const { path } = await upRes.json();
        logoPath = path;
      }
      const url = editing ? `/api/admin/clientes/${editing.id}` : "/api/admin/clientes";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, logoUrl: logoPath }),
      });
      if (res.ok) {
        toast.success(editing ? "Cliente atualizado!" : "Cliente criado!");
        setModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Cliente) => {
    if (!confirm(`Excluir cliente "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/clientes/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Cliente excluído");
      fetchData();
    } else {
      toast.error("Erro ao excluir");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
        <>
          <Table<Cliente>
            columns={[
              { key: "name", header: "Nome" },
              {
                key: "logoUrl",
                header: "Logo",
                render: (r) =>
                  r.logoUrl ? (
                    <img src={r.logoUrl} alt="" className="h-8 w-auto object-contain max-w-[80px]" />
                  ) : (
                    <span className="text-zinc-500">-</span>
                  ),
              },
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
        </>
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
            <label className="block text-sm font-medium text-zinc-300 mb-1">Logo (PNG, JPEG ou SVG, máx 2MB)</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 cursor-pointer hover:bg-zinc-800">
                <IconUpload size={18} strokeWidth={2} />
                <span className="text-sm">{logoFile ? logoFile.name : "Selecionar arquivo"}</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
              {editing?.logoUrl && !logoFile && (
                <img src={editing.logoUrl} alt="" className="h-10 w-auto object-contain" />
              )}
            </div>
          </div>
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
    </div>
  );
}
