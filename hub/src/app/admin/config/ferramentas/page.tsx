"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconKey } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

type Tool = {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  type: string;
  powerbiUrl?: string | null;
  status: string;
  description?: string;
  dbConnectionId?: string | null;
  client: { name: string };
};

function ToolPermissoesModal({ tool, onClose, onUpdate }: { tool: Tool; onClose: () => void; onUpdate: () => void }) {
  const [perms, setPerms] = useState<{ id: string; principalType: string; principalId: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [grupos, setGrupos] = useState<{ id: string; name: string }[]>([]);
  const [setores, setSetores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selUser, setSelUser] = useState("");
  const [selGroup, setSelGroup] = useState("");
  const [selSector, setSelSector] = useState("");

  const fetchData = useCallback(async () => {
    const [pRes, uRes, gRes, sRes] = await Promise.all([
      fetch(`/api/admin/tool-permissions?toolId=${tool.id}`),
      fetch("/api/admin/usuarios"),
      fetch("/api/admin/grupos"),
      fetch("/api/admin/setores"),
    ]);
    if (pRes.ok) setPerms(await pRes.json());
    if (uRes.ok) setUsers(await uRes.json());
    if (gRes.ok) setGrupos(await gRes.json());
    if (sRes.ok) setSetores(await sRes.json());
  }, [tool.id]);

  useEffect(() => {
    setLoading(true);
    fetchData().then(() => setLoading(false));
  }, [fetchData]);

  const getName = (type: string, id: string) => {
    if (type === "user") return users.find((u) => u.id === id)?.name ?? id;
    if (type === "group") return grupos.find((g) => g.id === id)?.name ?? id;
    if (type === "sector") return setores.find((s) => s.id === id)?.name ?? id;
    return id;
  };

  const addPerm = async (principalType: "user" | "group" | "sector", principalId: string) => {
    if (!principalId) return;
    const res = await fetch("/api/admin/tool-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: tool.id, principalType, principalId }),
    });
    if (res.ok) { setSelUser(""); setSelGroup(""); setSelSector(""); fetchData(); onUpdate(); } else toast.error((await res.json()).error || "Erro");
  };

  const removePerm = async (id: string) => {
    if (!confirm("Remover permissão?")) return;
    const res = await fetch("/api/admin/tool-permissions/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { toast.success("Permissão removida"); fetchData(); onUpdate(); }
  };

  const userPerms = perms.filter((p) => p.principalType === "user");
  const groupPerms = perms.filter((p) => p.principalType === "group");
  const sectorPerms = perms.filter((p) => p.principalType === "sector");

  return (
    <Modal isOpen onClose={onClose} title={`Permissões - ${tool.name}`} maxWidth="lg">
      {loading ? (
        <p className="text-zinc-500 py-4">Carregando...</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Usuários</h3>
            <div className="flex gap-2 mb-2">
              <select value={selUser} onChange={(e) => setSelUser(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione</option>
                {users.filter((u) => !userPerms.some((p) => p.principalId === u.id)).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <Button variant="secondary" onClick={() => addPerm("user", selUser)} disabled={!selUser}>Adicionar</Button>
            </div>
            <ul className="space-y-1">
              {userPerms.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50 text-sm">
                  <span>{getName("user", p.principalId)}</span>
                  <button type="button" onClick={() => removePerm(p.id)} className="p-1.5 text-zinc-400 hover:text-red-400"><IconTrash size={14} strokeWidth={2} /></button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Setores</h3>
            <div className="flex gap-2 mb-2">
              <select value={selGroup} onChange={(e) => setSelGroup(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione</option>
                {grupos.filter((g) => !groupPerms.some((p) => p.principalId === g.id)).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={() => addPerm("group", selGroup)} disabled={!selGroup}>Adicionar</Button>
            </div>
            <ul className="space-y-1">
              {groupPerms.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50 text-sm">
                  <span>{getName("group", p.principalId)}</span>
                  <button type="button" onClick={() => removePerm(p.id)} className="p-1.5 text-zinc-400 hover:text-red-400"><IconTrash size={14} strokeWidth={2} /></button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Grupos</h3>
            <div className="flex gap-2 mb-2">
              <select value={selSector} onChange={(e) => setSelSector(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione</option>
                {setores.filter((s) => !sectorPerms.some((p) => p.principalId === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={() => addPerm("sector", selSector)} disabled={!selSector}>Adicionar</Button>
            </div>
            <ul className="space-y-1">
              {sectorPerms.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50 text-sm">
                  <span>{getName("sector", p.principalId)}</span>
                  <button type="button" onClick={() => removePerm(p.id)} className="p-1.5 text-zinc-400 hover:text-red-400"><IconTrash size={14} strokeWidth={2} /></button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function FerramentasPage() {
  const [data, setData] = useState<Tool[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [conexoes, setConexoes] = useState<{ id: string; clientId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [permModalTool, setPermModalTool] = useState<Tool | null>(null);
  const [editing, setEditing] = useState<Tool | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    name: "",
    slug: "",
    description: "",
    type: "report" as "report" | "powerbi_report" | "integration" | "query_runner" | "app",
    powerbiUrl: "",
    status: "active" as "active" | "inactive",
    dbConnectionId: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tRes, cRes, connRes] = await Promise.all([
      fetch(`/api/admin/tools?page=${page}&limit=${pageSize}`),
      fetch("/api/admin/clientes"),
      fetch("/api/admin/conexoes"),
    ]);
    if (tRes.ok) {
      const json = await tRes.json();
      setData(json.data ?? json);
      setTotal(json.total ?? 0);
    }
    if (cRes.ok) setClientes(await cRes.json());
    if (connRes.ok) setConexoes(await connRes.json());
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      clientId: clientes[0]?.id ?? "",
      name: "",
      slug: "",
      description: "",
      type: "report",
      powerbiUrl: "",
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
      type: (row.type || "report") as "report" | "powerbi_report" | "integration" | "query_runner" | "app",
      powerbiUrl: row.powerbiUrl ?? "",
      status: (row.status || "active") as "active" | "inactive",
      dbConnectionId: row.dbConnectionId ?? "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.name || !form.slug) { toast.error("Preencha os campos obrigatórios"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/tools/${editing.id}` : "/api/admin/tools";
      const method = editing ? "PATCH" : "POST";
      const body = { ...form, dbConnectionId: form.dbConnectionId || undefined, powerbiUrl: form.powerbiUrl || null };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { toast.success(editing ? "Ferramenta atualizada!" : "Ferramenta criada!"); setModalOpen(false); fetchData(); } else toast.error((await res.json()).error || "Erro");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: Tool) => {
    if (!confirm(`Excluir ferramenta "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/tools/${row.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Ferramenta excluída"); fetchData(); } else toast.error("Erro ao excluir");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
                  {r.type === "powerbi_report" && (
                    <button onClick={(e) => { e.stopPropagation(); setPermModalTool(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800" title="Permissões"><IconKey size={18} strokeWidth={2} /></button>
                  )}
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
              <option value="powerbi_report">Relatório Power BI</option>
              <option value="integration">Integração</option>
              <option value="query_runner">Query Runner</option>
              <option value="app">App</option>
            </select>
          </div>
          {form.type === "powerbi_report" && (
            <Input label="URL do Relatório (Power BI/Fabric)" value={form.powerbiUrl} onChange={(e) => setForm((f) => ({ ...f, powerbiUrl: e.target.value }))} placeholder="https://app.fabric.microsoft.com/view?r=..." required />
          )}
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

      {permModalTool && (
        <ToolPermissoesModal tool={permModalTool} onClose={() => setPermModalTool(null)} onUpdate={fetchData} />
      )}
    </div>
  );
}
