"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { IconPlus, IconPencil, IconTrash, IconUpload, IconTools, IconUsers } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import type { SortDirection } from "@/components/ui/Table";

type Cliente = {
  id: string;
  name: string;
  logoUrl?: string | null;
  status: string;
  relatoriosEnabled?: boolean;
  ajusteDespesaEnabled?: boolean;
  negociacoesEnabled?: boolean;
  helpdeskEnabled?: boolean;
};

function FerramentasClienteModal({
  client,
  onClose,
}: {
  client: Cliente;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [menuFeatures, setMenuFeatures] = useState({
    relatorios: true,
    ajusteDespesa: true,
    negociacoes: true,
    helpdesk: true,
  });
  const [savingFeatures, setSavingFeatures] = useState(false);

  const fetchData = useCallback(async () => {
    const clientRes = await fetch(`/api/admin/clientes/${client.id}`);
    if (clientRes.ok) {
      const c = (await clientRes.json()) as Cliente;
      setMenuFeatures({
        relatorios: c.relatoriosEnabled ?? true,
        ajusteDespesa: c.ajusteDespesaEnabled ?? true,
        negociacoes: c.negociacoesEnabled ?? true,
        helpdesk: c.helpdeskEnabled ?? true,
      });
    }
    setLoading(false);
  }, [client.id]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const saveMenuFeatures = async () => {
    setSavingFeatures(true);
    try {
      const res = await fetch(`/api/admin/clientes/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relatoriosEnabled: menuFeatures.relatorios,
          ajusteDespesaEnabled: menuFeatures.ajusteDespesa,
          negociacoesEnabled: menuFeatures.negociacoes,
          helpdeskEnabled: menuFeatures.helpdesk,
        }),
      });
      if (res.ok) toast.success("Funcionalidades salvas.");
      else toast.error((await res.json()).error || "Erro ao salvar");
    } finally {
      setSavingFeatures(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Ferramentas - ${client.name}`} maxWidth="lg">
      {loading ? (
        <p className="text-zinc-500 py-4">Carregando...</p>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-700 pb-2 mb-3">Funcionalidades do menu lateral</h3>
            <p className="text-xs text-zinc-500 mb-3">
              Marque quais itens do menu do portal os usuários com este cliente em Permissões podem ver.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={menuFeatures.relatorios}
                  onChange={(e) => setMenuFeatures((f) => ({ ...f, relatorios: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800 text-amber-500"
                />
                Relatórios
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={menuFeatures.ajusteDespesa}
                  onChange={(e) => setMenuFeatures((f) => ({ ...f, ajusteDespesa: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800 text-amber-500"
                />
                Ajuste de Despesas
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={menuFeatures.negociacoes}
                  onChange={(e) => setMenuFeatures((f) => ({ ...f, negociacoes: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800 text-amber-500"
                />
                Negociações
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={menuFeatures.helpdesk}
                  onChange={(e) => setMenuFeatures((f) => ({ ...f, helpdesk: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800 text-amber-500"
                />
                Helpdesk
              </label>
            </div>
            <Button type="button" onClick={saveMenuFeatures} isLoading={savingFeatures} className="mt-2">
              Salvar funcionalidades
            </Button>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

type ProprietarioItem = {
  id: string;
  userId: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

function ProprietariosClienteModal({
  client,
  onClose,
}: {
  client: Cliente;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [proprietarios, setProprietarios] = useState<ProprietarioItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selUserId, setSelUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/admin/clientes/${client.id}/proprietarios`);
    if (res.ok) {
      const data = await res.json();
      setProprietarios(data.proprietarios ?? []);
      setAvailableUsers(data.availableUsers ?? []);
    }
    setLoading(false);
  }, [client.id]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const addProprietario = async () => {
    if (!selUserId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/clientes/${client.id}/proprietarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selUserId }),
      });
      if (res.ok) {
        toast.success("Proprietário adicionado.");
        setSelUserId("");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao adicionar");
      }
    } finally {
      setAdding(false);
    }
  };

  const removeProprietario = async (proprietarioId: string) => {
    if (!confirm("Remover este proprietário do cliente?")) return;
    setRemoving(proprietarioId);
    try {
      const res = await fetch(`/api/admin/clientes/${client.id}/proprietarios/${proprietarioId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Proprietário removido.");
        fetchData();
      } else {
        toast.error("Erro ao remover");
      }
    } finally {
      setRemoving(null);
    }
  };

  const userIdsAlreadyProprietarios = new Set(proprietarios.map((p) => p.userId));
  const usersToAdd = availableUsers.filter((u) => !userIdsAlreadyProprietarios.has(u.id));

  return (
    <Modal isOpen onClose={onClose} title={`Proprietários - ${client.name}`} maxWidth="lg">
      {loading ? (
        <p className="text-zinc-500 py-4">Carregando...</p>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-zinc-500">
            Proprietários do cliente podem aprovar chamados de tipo &quot;Cadastro e aprovação de desconto comercial&quot; quando o valor do desconto for maior que 20 centavos (são necessárias 2 aprovações de proprietários).
          </p>
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-700 pb-2 mb-3">Proprietários vinculados</h3>
            {proprietarios.length === 0 ? (
              <p className="text-zinc-500 text-sm">Nenhum proprietário vinculado.</p>
            ) : (
              <ul className="space-y-2">
                {proprietarios.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 border-b border-zinc-800">
                    <span className="text-sm text-zinc-200">{p.user.name} ({p.user.email})</span>
                    <button
                      type="button"
                      onClick={() => removeProprietario(p.id)}
                      disabled={removing === p.id}
                      className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
                    >
                      {removing === p.id ? "Removendo..." : "Remover"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-700 pb-2 mb-3">Adicionar proprietário</h3>
            <p className="text-xs text-zinc-500 mb-2">Apenas usuários com acesso a este cliente podem ser proprietários.</p>
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={selUserId}
                onChange={(e) => setSelUserId(e.target.value)}
                className="rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 px-3 py-2 min-w-[200px]"
                aria-label="Selecionar usuário"
              >
                <option value="">Selecione um usuário</option>
                {usersToAdd.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <Button type="button" onClick={addProprietario} disabled={!selUserId || adding} isLoading={adding}>
                Adicionar
              </Button>
            </div>
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [ferramentasModalCliente, setFerramentasModalCliente] = useState<Cliente | null>(null);
  const [proprietariosModalCliente, setProprietariosModalCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("default");

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }
    setSortDirection((d) => (d === "default" ? "asc" : d === "asc" ? "desc" : "default"));
    if (sortDirection === "desc") setSortKey("");
  };

  const filteredData = data.filter(
    (r) => !searchTerm || String(r.name ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );
  const sortedData =
    sortDirection === "default" || !sortKey
      ? filteredData
      : [...filteredData].sort((a, b) => {
          const va = String((a as Record<string, unknown>)[sortKey] ?? "");
          const vb = String((b as Record<string, unknown>)[sortKey] ?? "");
          return (sortDirection === "asc" ? 1 : -1) * va.localeCompare(vb, "pt-BR", { sensitivity: "base" });
        });

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
      let logoPath: string | null = editing?.logoUrl ?? null;
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        const upRes = await fetch("/api/admin/upload/logo", {
          method: "POST",
          body: formData,
        });
        const upJson = await upRes.json().catch(() => ({}));
        if (!upRes.ok) {
          toast.error(upJson?.error || "Erro ao fazer upload da logo");
          return;
        }
        const path = upJson?.path;
        if (path && typeof path === "string") {
          logoPath = path;
        } else {
          toast.error("Resposta do upload inválida. Tente novamente.");
          return;
        }
      }
      const url = editing ? `/api/admin/clientes/${editing.id}` : "/api/admin/clientes";
      const method = editing ? "PATCH" : "POST";
      const body = { name: form.name, status: form.status, logoUrl: logoPath };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editing ? "Cliente atualizado!" : "Cliente criado!");
        setModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao salvar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar cliente");
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
      <div className="mb-4">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nome..." />
      </div>
      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : (
        <>
          <Table<Cliente>
            columns={[
              { key: "name", header: "Nome", sortable: true },
              {
                key: "logoUrl",
                header: "Logo",
                render: (r) =>
                  r.logoUrl ? (
                    <Image src={r.logoUrl} alt="" width={80} height={32} className="h-8 w-auto object-contain max-w-[80px]" />
                  ) : (
                    <span className="text-zinc-500">-</span>
                  ),
              },
              {
                key: "status",
                header: "Status",
                sortable: true,
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
                      onClick={(e) => { e.stopPropagation(); setProprietariosModalCliente(r); }}
                      className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                      title="Proprietários do cliente"
                    >
                      <IconUsers size={18} strokeWidth={2} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFerramentasModalCliente(r); }}
                      className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                      title="Ferramentas deste cliente"
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
            data={sortedData}
            keyExtractor={(r) => r.id}
            sortKey={sortKey || undefined}
            sortDirection={sortDirection}
            onSort={handleSort}
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
                <Image src={editing.logoUrl} alt="" width={40} height={40} className="h-10 w-auto object-contain" />
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

      {ferramentasModalCliente && (
        <FerramentasClienteModal
          client={ferramentasModalCliente}
          onClose={() => setFerramentasModalCliente(null)}
        />
      )}
      {proprietariosModalCliente && (
        <ProprietariosClienteModal
          client={proprietariosModalCliente}
          onClose={() => setProprietariosModalCliente(null)}
        />
      )}
    </div>
  );
}
