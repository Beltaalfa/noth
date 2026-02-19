"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconPlugConnected } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import type { SortDirection } from "@/components/ui/Table";

type Conexao = {
  id: string;
  clientId: string;
  type: string;
  host: string;
  port: number;
  user: string;
  database: string;
  status: string;
  client: { name: string };
};

export default function ConexoesPage() {
  const [data, setData] = useState<Conexao[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conexao | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    type: "postgres" as "postgres" | "firebird",
    host: "",
    port: 5432,
    user: "",
    password: "",
    database: "",
    extraParams: "",
    status: "active" as "active" | "inactive",
  });
  const [saving, setSaving] = useState(false);
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
    (r) =>
      !searchTerm ||
      [r.client?.name, r.host, r.database, r.user].some((v) =>
        String(v ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      )
  );
  const getSortVal = (r: Conexao, k: string) =>
    k === "client" ? String(r.client?.name ?? "") : String((r as Record<string, unknown>)[k] ?? "");
  const sortedData =
    sortDirection === "default" || !sortKey
      ? filteredData
      : [...filteredData].sort((a, b) => {
          const va = getSortVal(a, sortKey);
          const vb = getSortVal(b, sortKey);
          return (sortDirection === "asc" ? 1 : -1) * va.localeCompare(vb, "pt-BR", { sensitivity: "base" });
        });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [cRes, clRes] = await Promise.all([
      fetch(`/api/admin/conexoes?page=${page}&limit=${pageSize}`),
      fetch("/api/admin/clientes"),
    ]);
    if (cRes.ok) {
      const json = await cRes.json();
      setData(json.data ?? json);
      setTotal(json.total ?? 0);
    }
    if (clRes.ok) setClientes(await clRes.json());
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      clientId: clientes[0]?.id ?? "",
      type: "postgres",
      host: "",
      port: 5432,
      user: "",
      password: "",
      database: "",
      extraParams: "",
      status: "active",
    });
    setTestResult(null);
    setModalOpen(true);
  };

  const openEdit = (row: Conexao) => {
    setEditing(row);
    setForm({
      clientId: row.clientId ?? "",
      type: row.type as "postgres" | "firebird",
      host: row.host,
      port: row.port,
      user: row.user ?? "",
      password: "",
      database: row.database,
      extraParams: (row as { extraParams?: string }).extraParams ?? "",
      status: row.status as "active" | "inactive",
    });
    setTestResult(null);
    setModalOpen(true);
  };

  const handleTest = async () => {
    if (editing) {
      setTestingId(editing.id);
      setTestResult(null);
      const res = await fetch("/api/admin/conexoes/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id }),
      });
      const result = await res.json();
      setTestResult(result);
      setTestingId(null);
    } else {
      setTestResult(null);
      const res = await fetch("/api/admin/conexoes/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          host: form.host,
          port: form.port,
          user: form.user,
          password: form.password,
          database: form.database,
        }),
      });
      const result = await res.json();
      setTestResult(result);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error("Selecione um cliente"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/conexoes/${editing.id}` : "/api/admin/conexoes";
      const method = editing ? "PATCH" : "POST";
      const { password, ...formWithoutPassword } = form;
      const body = editing && !password ? formWithoutPassword : { ...form };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { toast.success(editing ? "Conexão atualizada!" : "Conexão criada!"); setModalOpen(false); fetchData(); } else toast.error((await res.json()).error || "Erro");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: Conexao) => {
    if (!confirm("Excluir esta conexão?")) return;
    const res = await fetch(`/api/admin/conexoes/${row.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Conexão excluída"); fetchData(); } else toast.error("Erro ao excluir");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const testFromList = async (row: Conexao) => {
    setTestingId(row.id);
    const res = await fetch("/api/admin/conexoes/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const result = await res.json();
    toast[result.ok ? "success" : "error"](result.ok ? "Conexão OK!" : `Erro: ${result.message}`);
    setTestingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Conexões de Banco</h1>
        <Button onClick={openCreate} className="gap-2" disabled={clientes.length === 0}>
          <IconPlus size={18} strokeWidth={2} /> Nova conexão
        </Button>
      </div>
      <div className="mb-4">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por cliente, host, database..." />
      </div>
      {loading ? <p className="text-zinc-500">Carregando...</p> : (
        <Table<Conexao>
          columns={[
            { key: "client", header: "Cliente", sortable: true, render: (r) => r.client?.name ?? "-" },
            { key: "type", header: "Tipo", sortable: true, render: (r) => r.type === "postgres" ? "PostgreSQL" : "Firebird" },
            { key: "host", header: "Host", sortable: true },
            { key: "port", header: "Porta", sortable: true },
            { key: "database", header: "Database", sortable: true },
            { key: "status", header: "Status", sortable: true, render: (r) => <span className={r.status === "active" ? "text-green-400" : "text-zinc-500"}>{r.status === "active" ? "Ativo" : "Inativo"}</span> },
            {
              key: "actions",
              header: "Ações",
              render: (r) => (
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); testFromList(r); }} disabled={testingId !== null} className="p-2 rounded-lg text-zinc-400 hover:text-green-400 hover:bg-zinc-800 disabled:opacity-50" title="Testar"><IconPlugConnected size={18} strokeWidth={2} /></button>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
                </div>
              ),
            },
          ]}
          data={sortedData}
          keyExtractor={(r) => r.id}
          emptyMessage="Nenhuma conexão. Cadastre clientes primeiro."
          sortKey={sortKey || undefined}
          sortDirection={sortDirection}
          onSort={handleSort}
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
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar conexão" : "Nova conexão"} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Cliente</label>
            <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} required className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="">Selecione</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Tipo</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "postgres" | "firebird" }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="postgres">PostgreSQL</option>
              <option value="firebird">Firebird</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Host" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} required />
            <Input label="Porta" type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) || 5432 }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Usuário" value={form.user} onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))} required />
            <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={editing ? "Deixe em branco para manter" : ""} required={!editing} />
          </div>
          <Input label="Database" value={form.database} onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))} required />
          {testResult && (
            <div className={`p-3 rounded-lg text-sm ${testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {testResult.ok ? "Conexão OK!" : testResult.message}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={handleTest} isLoading={testingId !== null}>Testar conexão</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" isLoading={saving}>Salvar</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
