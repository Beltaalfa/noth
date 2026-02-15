"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconKey } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

type User = { id: string; name: string; email: string; status: string; role: string };

type PermData = {
  userClient: { id: string; userId: string; clientId: string; client: { name: string } }[];
  userGroup: { id: string; userId: string; groupId: string; group: { name: string } }[];
  userSector: { id: string; userId: string; sectorId: string; sector: { name: string } }[];
};

function PermissoesModal({
  user,
  onClose,
  onUpdate,
}: { user: User; onClose: () => void; onUpdate: () => void }) {
  const [permData, setPermData] = useState<PermData | null>(null);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [grupos, setGrupos] = useState<{ id: string; name: string; clientId: string }[]>([]);
  const [setores, setSetores] = useState<{ id: string; name: string; groupId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selClient, setSelClient] = useState("");
  const [selGroup, setSelGroup] = useState("");
  const [selSector, setSelSector] = useState("");

  const fetchPerm = useCallback(async () => {
    const [pRes, cRes, gRes, sRes] = await Promise.all([
      fetch("/api/admin/permissoes"),
      fetch("/api/admin/clientes"),
      fetch("/api/admin/grupos"),
      fetch("/api/admin/setores"),
    ]);
    if (pRes.ok) setPermData(await pRes.json());
    if (cRes.ok) setClientes(await cRes.json());
    if (gRes.ok) setGrupos(await gRes.json());
    if (sRes.ok) setSetores(await sRes.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPerm().then(() => setLoading(false));
  }, [fetchPerm]);

  const userClients = permData?.userClient.filter((uc) => uc.userId === user.id) ?? [];
  const userGroups = permData?.userGroup.filter((ug) => ug.userId === user.id) ?? [];
  const userSectors = permData?.userSector.filter((us) => us.userId === user.id) ?? [];

  const addClient = async () => {
    if (!selClient) return;
    const res = await fetch("/api/admin/permissoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "userClient", userId: user.id, clientId: selClient }),
    });
    if (res.ok) { setSelClient(""); fetchPerm(); onUpdate(); } else toast.error((await res.json()).error || "Erro");
  };
  const addGroup = async () => {
    if (!selGroup) return;
    const res = await fetch("/api/admin/permissoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "userGroup", userId: user.id, groupId: selGroup }),
    });
    if (res.ok) { setSelGroup(""); fetchPerm(); onUpdate(); } else toast.error((await res.json()).error || "Erro");
  };
  const addSector = async () => {
    if (!selSector) return;
    const res = await fetch("/api/admin/permissoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "userSector", userId: user.id, sectorId: selSector }),
    });
    if (res.ok) { setSelSector(""); fetchPerm(); onUpdate(); } else toast.error((await res.json()).error || "Erro");
  };

  const removePerm = async (action: "userClient" | "userGroup" | "userSector", id: string) => {
    if (!confirm("Remover vínculo?")) return;
    const res = await fetch("/api/admin/permissoes/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    if (res.ok) { fetchPerm(); onUpdate(); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Permissões - ${user.name}`} maxWidth="lg">
      {loading ? (
        <p className="text-zinc-500 py-4">Carregando...</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Clientes</h3>
            <div className="flex gap-2 mb-2">
              <select value={selClient} onChange={(e) => setSelClient(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione um cliente</option>
                {clientes.filter((c) => !userClients.some((uc) => uc.clientId === c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={addClient} disabled={!selClient}>Adicionar</Button>
            </div>
            <ul className="space-y-1">
              {userClients.map((uc) => (
                <li key={uc.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50 text-sm">
                  <span>{uc.client.name}</span>
                  <button type="button" onClick={() => removePerm("userClient", uc.id)} className="p-1.5 text-zinc-400 hover:text-red-400"><IconTrash size={14} strokeWidth={2} /></button>
                </li>
              ))}
            </ul>
            {userClients.length === 0 && <p className="text-zinc-500 text-sm py-2">Nenhum cliente vinculado</p>}
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Grupos</h3>
            <div className="flex gap-2 mb-2">
              <select value={selGroup} onChange={(e) => setSelGroup(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione um grupo</option>
                {grupos.filter((g) => !userGroups.some((ug) => ug.groupId === g.id)).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={addGroup} disabled={!selGroup}>Adicionar</Button>
            </div>
            <ul className="space-y-1">
              {userGroups.map((ug) => (
                <li key={ug.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50 text-sm">
                  <span>{ug.group.name}</span>
                  <button type="button" onClick={() => removePerm("userGroup", ug.id)} className="p-1.5 text-zinc-400 hover:text-red-400"><IconTrash size={14} strokeWidth={2} /></button>
                </li>
              ))}
            </ul>
            {userGroups.length === 0 && <p className="text-zinc-500 text-sm py-2">Nenhum grupo vinculado</p>}
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Setores</h3>
            <div className="flex gap-2 mb-2">
              <select value={selSector} onChange={(e) => setSelSector(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione um setor</option>
                {setores.filter((s) => !userSectors.some((us) => us.sectorId === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={addSector} disabled={!selSector}>Adicionar</Button>
            </div>
            <ul className="space-y-1">
              {userSectors.map((us) => (
                <li key={us.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-zinc-800/50 text-sm">
                  <span>{us.sector.name}</span>
                  <button type="button" onClick={() => removePerm("userSector", us.id)} className="p-1.5 text-zinc-400 hover:text-red-400"><IconTrash size={14} strokeWidth={2} /></button>
                </li>
              ))}
            </ul>
            {userSectors.length === 0 && <p className="text-zinc-500 text-sm py-2">Nenhum setor vinculado</p>}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function UsuariosPage() {
  const [data, setData] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [permModalUser, setPermModalUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    status: "active" as "active" | "inactive",
    role: "client" as "client" | "admin",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/usuarios?page=${page}&limit=${pageSize}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.data ?? json);
      setTotal(json.total ?? json.data?.length ?? json.length ?? 0);
    }
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "", status: "active", role: "client" });
    setModalOpen(true);
  };

  const openEdit = (row: User) => {
    setEditing(row);
    setForm({ name: row.name, email: row.email, password: "", status: row.status as "active" | "inactive", role: row.role as "client" | "admin" });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/usuarios/${editing.id}` : "/api/admin/usuarios";
      const method = editing ? "PATCH" : "POST";
      const body: Record<string, unknown> = { ...form };
      if (editing && !body.password) delete body.password;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { toast.success(editing ? "Usuário atualizado!" : "Usuário criado!"); setModalOpen(false); fetchData(); } else toast.error((await res.json()).error || "Erro");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: User) => {
    if (!confirm(`Excluir "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/usuarios/${row.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Usuário excluído"); fetchData(); } else toast.error("Erro ao excluir");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Usuários</h1>
        <Button onClick={openCreate} className="gap-2">
          <IconPlus size={18} strokeWidth={2} /> Novo usuário
        </Button>
      </div>
      {loading ? <p className="text-zinc-500">Carregando...</p> : (
        <Table<User>
          columns={[
            { key: "name", header: "Nome" },
            { key: "email", header: "Email" },
            { key: "role", header: "Perfil", render: (r) => r.role === "admin" ? "Admin" : "Cliente" },
            { key: "status", header: "Status", render: (r) => <span className={r.status === "active" ? "text-green-400" : "text-zinc-500"}>{r.status === "active" ? "Ativo" : "Inativo"}</span> },
            { key: "actions", header: "Ações", render: (r) => (
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setPermModalUser(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800" title="Permissões"><IconKey size={18} strokeWidth={2} /></button>
                <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
              </div>
            ) },
          ]}
          data={data}
          keyExtractor={(r) => r.id}
        />
      )}
      {total > 0 && (
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / pageSize))}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar usuário" : "Novo usuário"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required disabled={!!editing} />
          <Input label={editing ? "Nova senha (deixe em branco para manter)" : "Senha"} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!editing} />
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Perfil</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "client" | "admin" }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100">
              <option value="client">Cliente</option>
              <option value="admin">Admin</option>
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

      {permModalUser && (
        <PermissoesModal
          user={permModalUser}
          onClose={() => setPermModalUser(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
