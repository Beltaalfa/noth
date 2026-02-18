"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconKey } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

type Report = {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  type: string;
  powerbiUrl?: string | null;
  status: string;
  client: { name: string };
};

function ToolPermissoesModal({
  tool,
  onClose,
  onUpdate,
}: {
  tool: Report;
  onClose: () => void;
  onUpdate: () => void;
}) {
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
    if (res.ok) {
      setSelUser("");
      setSelGroup("");
      setSelSector("");
      fetchData();
      onUpdate();
    } else toast.error((await res.json()).error || "Erro");
  };

  const removePerm = async (id: string) => {
    if (!confirm("Remover permissão?")) return;
    const res = await fetch("/api/admin/tool-permissions/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      fetchData();
      onUpdate();
    }
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
              <select
                value={selUser}
                onChange={(e) => setSelUser(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm"
              >
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
              <select
                value={selGroup}
                onChange={(e) => setSelGroup(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm"
              >
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
              <select
                value={selSector}
                onChange={(e) => setSelSector(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm"
              >
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

export default function RelatoriosPage() {
  const [data, setData] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [permModalTool, setPermModalTool] = useState<Report | null>(null);
  const [editing, setEditing] = useState<Report | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    name: "",
    slug: "",
    powerbiUrl: "",
    status: "active" as "active" | "inactive",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tRes, cRes] = await Promise.all([
      fetch(`/api/admin/tools?page=${page}&limit=${pageSize}&type=powerbi_report`),
      fetch("/api/admin/clientes"),
    ]);
    if (tRes.ok) {
      const json = await tRes.json();
      setData(json.data ?? json);
      setTotal(json.total ?? 0);
    }
    if (cRes.ok) setClientes(await cRes.json());
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      clientId: clientes[0]?.id ?? "",
      name: "",
      slug: "",
      powerbiUrl: "",
      status: "active",
    });
    setModalOpen(true);
  };

  const openEdit = (row: Report) => {
    setEditing(row);
    setForm({
      clientId: row.clientId ?? "",
      name: row.name,
      slug: row.slug,
      powerbiUrl: row.powerbiUrl ?? "",
      status: (row.status || "active") as "active" | "inactive",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.name || !form.slug || !form.powerbiUrl) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/tools/${editing.id}` : "/api/admin/tools";
      const method = editing ? "PATCH" : "POST";
      const body = editing
        ? { name: form.name, slug: form.slug, powerbiUrl: form.powerbiUrl, status: form.status }
        : {
            clientId: form.clientId,
            name: form.name,
            slug: form.slug,
            type: "powerbi_report",
            powerbiUrl: form.powerbiUrl,
            status: form.status,
          };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editing ? "Relatório atualizado!" : "Relatório criado!");
        setModalOpen(false);
        fetchData();
      } else {
        toast.error((await res.json()).error || "Erro");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Report) => {
    if (!confirm(`Excluir relatório "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/tools/${row.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Relatório excluído"); fetchData(); } else toast.error("Erro ao excluir");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Relatórios</h1>
        <Button onClick={openCreate} className="gap-2" disabled={clientes.length === 0}>
          <IconPlus size={18} strokeWidth={2} /> Novo relatório
        </Button>
      </div>
      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : (
        <Table<Report>
          columns={[
            { key: "name", header: "Nome" },
            { key: "slug", header: "Slug" },
            { key: "client", header: "Cliente", render: (r) => r.client?.name ?? "-" },
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
                    onClick={(e) => { e.stopPropagation(); setPermModalTool(r); }}
                    className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                    title="Permissões"
                  >
                    <IconKey size={18} strokeWidth={2} />
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
          emptyMessage="Nenhum relatório. Cadastre clientes primeiro e clique em Novo relatório."
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
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar relatório" : "Novo relatório"} maxWidth="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Cliente</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              required
              disabled={!!editing}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100"
            >
              <option value="">Selecione</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Nome do relatório"
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                name: e.target.value,
                slug: !editing ? e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : f.slug,
              }))
            }
            required
          />
          <Input label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="bi-comercial" required />
          <Input
            label="URL do relatório (Power BI/Fabric)"
            value={form.powerbiUrl}
            onChange={(e) => setForm((f) => ({ ...f, powerbiUrl: e.target.value }))}
            placeholder="https://app.fabric.microsoft.com/view?r=..."
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
