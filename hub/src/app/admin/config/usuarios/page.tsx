"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconPencil, IconTrash, IconKey, IconListCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import type { SortDirection } from "@/components/ui/Table";

type User = {
  id: string; name: string; email: string; status: string; role: string;
  helpdeskNivelAcesso?: string | null;
  primaryGroupId?: string | null;
  primarySectorId?: string | null;
  isGerenteArea?: boolean;
  podeReceberChamados?: boolean;
  podeEncaminharChamados?: boolean;
  valorMaximoAutorizar?: number | null;
  clientCount?: number;
  allowRelatorios?: boolean | null;
  allowAjusteDespesa?: boolean | null;
  allowNegociacoes?: boolean | null;
  allowHelpdesk?: boolean | null;
};

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
          <p className="text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-3">
            Os <strong>clientes</strong> vinculados aqui definem o que o usuário vê no portal: <strong>Helpdesk</strong> (acesso aos chamados desse cliente) e <strong>ferramentas</strong> liberadas para cada cliente. Sem nenhum cliente, o menu do usuário fica só com Dashboard e Minha conta.
          </p>
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
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Setores</h3>
            <div className="flex gap-2 mb-2">
              <select value={selGroup} onChange={(e) => setSelGroup(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione um setor</option>
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
            {userGroups.length === 0 && <p className="text-zinc-500 text-sm py-2">Nenhum setor vinculado</p>}
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Grupos</h3>
            <div className="flex gap-2 mb-2">
              <select value={selSector} onChange={(e) => setSelSector(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                <option value="">Selecione um grupo</option>
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
            {userSectors.length === 0 && <p className="text-zinc-500 text-sm py-2">Nenhum grupo vinculado</p>}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function LiberacoesModal({ user, onClose, onUpdate }: { user: User; onClose: () => void; onUpdate: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allows, setAllows] = useState({
    relatorios: true,
    ajusteDespesa: true,
    negociacoes: true,
    helpdesk: true,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/usuarios/${user.id}`)
      .then((r) => r.json())
      .then((u: User) => {
        if (!cancelled) {
          setAllows({
            relatorios: u.allowRelatorios !== false,
            ajusteDespesa: u.allowAjusteDespesa !== false,
            negociacoes: u.allowNegociacoes !== false,
            helpdesk: u.allowHelpdesk !== false,
          });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user.id]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowRelatorios: allows.relatorios,
          allowAjusteDespesa: allows.ajusteDespesa,
          allowNegociacoes: allows.negociacoes,
          allowHelpdesk: allows.helpdesk,
        }),
      });
      if (res.ok) {
        toast.success("Liberações salvas.");
        onUpdate();
      } else toast.error((await res.json()).error || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Liberações de funções - ${user.name}`} maxWidth="md">
      {loading ? (
        <p className="text-zinc-500 py-4">Carregando...</p>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-zinc-500">
            Este usuário só verá e usará no portal as funções marcadas abaixo. O que está liberado para os clientes dele (em Clientes → Ferramentas) é filtrado por estas opções. Desmarque para ocultar a função para este usuário.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={allows.relatorios} onChange={(e) => setAllows((a) => ({ ...a, relatorios: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800 text-amber-500" />
              Relatórios
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={allows.ajusteDespesa} onChange={(e) => setAllows((a) => ({ ...a, ajusteDespesa: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800 text-amber-500" />
              Ajuste de Despesas
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={allows.negociacoes} onChange={(e) => setAllows((a) => ({ ...a, negociacoes: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800 text-amber-500" />
              Negociações
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={allows.helpdesk} onChange={(e) => setAllows((a) => ({ ...a, helpdesk: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800 text-amber-500" />
              Helpdesk
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
            <Button onClick={save} isLoading={saving}>Salvar liberações</Button>
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
  const [liberacoesModalUser, setLiberacoesModalUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
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
      [r.name, r.email].some((v) => String(v ?? "").toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const sortedData =
    sortDirection === "default" || !sortKey
      ? filteredData
      : [...filteredData].sort((a, b) => {
          const va = String((a as Record<string, unknown>)[sortKey] ?? "");
          const vb = String((b as Record<string, unknown>)[sortKey] ?? "");
          const cmp = va.localeCompare(vb, "pt-BR", { sensitivity: "base" });
          return sortDirection === "asc" ? cmp : -cmp;
        });

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    status: "active" as "active" | "inactive",
    role: "client" as "client" | "admin",
    helpdeskNivelAcesso: "" as "" | "solicitante" | "operador" | "gestor" | "admin",
    primaryGroupId: "" as string,
    primarySectorId: "" as string,
    isGerenteArea: false,
    podeReceberChamados: false,
    podeEncaminharChamados: false,
    valorMaximoAutorizar: "" as string,
  });
  const [saving, setSaving] = useState(false);
  const [grupos, setGrupos] = useState<{ id: string; name: string }[]>([]);
  const [setores, setSetores] = useState<{ id: string; name: string; groupId: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/usuarios?page=${page}&limit=${pageSize}`);
    if (res.ok) {
      const json = await res.json();
      const list = json.data ?? json;
      setData(Array.isArray(list) ? list : []);
      setTotal(json.total ?? (Array.isArray(list) ? list.length : 0));
    }
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    Promise.all([fetch("/api/admin/grupos"), fetch("/api/admin/setores")]).then(([gRes, sRes]) => {
      if (gRes.ok) gRes.json().then((arr: { id: string; name: string }[]) => setGrupos(Array.isArray(arr) ? arr : []));
      if (sRes.ok) sRes.json().then((arr: { id: string; name: string; groupId: string }[]) => setSetores(Array.isArray(arr) ? arr : []));
    });
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "", email: "", password: "", status: "active", role: "client",
      helpdeskNivelAcesso: "", primaryGroupId: "", primarySectorId: "", isGerenteArea: false,
      podeReceberChamados: false, podeEncaminharChamados: false, valorMaximoAutorizar: "",
    });
    setModalOpen(true);
  };

  const openEdit = (row: User) => {
    setEditing(row);
    setForm({
      name: row.name,
      email: row.email,
      password: "",
      status: row.status as "active" | "inactive",
      role: row.role as "client" | "admin",
      helpdeskNivelAcesso: (row.helpdeskNivelAcesso ?? "") as "" | "solicitante" | "operador" | "gestor" | "admin",
      primaryGroupId: row.primaryGroupId ?? "",
      primarySectorId: row.primarySectorId ?? "",
      isGerenteArea: row.isGerenteArea ?? false,
      podeReceberChamados: row.podeReceberChamados ?? false,
      podeEncaminharChamados: row.podeEncaminharChamados ?? false,
      valorMaximoAutorizar: row.valorMaximoAutorizar != null ? String(row.valorMaximoAutorizar) : "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/usuarios/${editing.id}` : "/api/admin/usuarios";
      const method = editing ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        password: form.password,
        status: form.status,
        role: form.role,
      };
      if (editing) {
        if (!form.password) delete body.password;
        body.helpdeskNivelAcesso = form.helpdeskNivelAcesso || null;
        body.primaryGroupId = form.primaryGroupId || null;
        body.primarySectorId = form.primarySectorId || null;
        body.isGerenteArea = form.isGerenteArea;
        body.podeReceberChamados = form.podeReceberChamados;
        body.podeEncaminharChamados = form.podeEncaminharChamados;
        body.valorMaximoAutorizar = form.valorMaximoAutorizar === "" ? null : Number(form.valorMaximoAutorizar);
      }
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-zinc-100">Usuários</h1>
        <Button onClick={openCreate} className="gap-2">
          <IconPlus size={18} strokeWidth={2} /> Novo usuário
        </Button>
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        Para o usuário ver <strong>Helpdesk</strong> e <strong>ferramentas</strong> no portal, vincule pelo menos um <strong>Cliente</strong> em Permissões (ícone de chave). A coluna &quot;Clientes&quot; mostra quantos clientes estão vinculados.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nome ou email..." />
      </div>
      {loading ? <p className="text-zinc-500">Carregando...</p> : (
        <Table<User>
          columns={[
            { key: "name", header: "Nome", sortable: true },
            { key: "email", header: "Email", sortable: true },
            { key: "role", header: "Perfil", sortable: true, render: (r) => r.role === "admin" ? "Admin" : "Cliente" },
            { key: "clientCount", header: "Clientes", render: (r) => (r.clientCount ?? 0) > 0 ? `${r.clientCount} cliente(s)` : "—" },
            { key: "helpdeskNivelAcesso", header: "Tipo Helpdesk", render: (r) => {
              const n = r.helpdeskNivelAcesso ?? "";
              return n ? (n === "solicitante" ? "Solicitante" : n === "operador" ? "Operador" : n === "gestor" ? "Gestor" : n === "admin" ? "Admin HD" : n) : "—";
            } },
            { key: "status", header: "Status", sortable: true, render: (r) => <span className={r.status === "active" ? "text-green-400" : "text-zinc-500"}>{r.status === "active" ? "Ativo" : "Inativo"}</span> },
            { key: "actions", header: "Ações", render: (r) => (
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setLiberacoesModalUser(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800" title="Liberações de funções"><IconListCheck size={18} strokeWidth={2} /></button>
                <button onClick={(e) => { e.stopPropagation(); setPermModalUser(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800" title="Permissões"><IconKey size={18} strokeWidth={2} /></button>
                <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-zinc-800" title="Editar"><IconPencil size={18} strokeWidth={2} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir"><IconTrash size={18} strokeWidth={2} /></button>
              </div>
            ) },
          ]}
          data={sortedData}
          keyExtractor={(r) => r.id}
          sortKey={sortKey || undefined}
          sortDirection={sortDirection}
          onSort={handleSort}
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
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar usuário" : "Novo usuário"} maxWidth="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {editing ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-700 pb-2">Dados gerais</h3>
                <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required disabled />
                <Input label="Nova senha (deixe em branco para manter)" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Perfil</label>
                    <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "client" | "admin" }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                      <option value="client">Cliente</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-700 pb-2">Perfil Help Desk</h3>
                <p className="text-xs text-zinc-500">Tipo de usuário e permissões no Helpdesk.</p>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Nível de acesso</label>
                  <select value={form.helpdeskNivelAcesso} onChange={(e) => setForm((f) => ({ ...f, helpdeskNivelAcesso: e.target.value as typeof form.helpdeskNivelAcesso }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                    <option value="">—</option>
                    <option value="solicitante">Solicitante</option>
                    <option value="operador">Operador</option>
                    <option value="gestor">Gestor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Setor</label>
                    <select value={form.primaryGroupId} onChange={(e) => setForm((f) => ({ ...f, primaryGroupId: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                      <option value="">—</option>
                      {grupos.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Grupo</label>
                    <select value={form.primarySectorId} onChange={(e) => setForm((f) => ({ ...f, primarySectorId: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm">
                      <option value="">—</option>
                      {setores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={form.isGerenteArea} onChange={(e) => setForm((f) => ({ ...f, isGerenteArea: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800 text-amber-500" />
                    Gerente área
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={form.podeReceberChamados} onChange={(e) => setForm((f) => ({ ...f, podeReceberChamados: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800 text-amber-500" />
                    Receber chamados
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={form.podeEncaminharChamados} onChange={(e) => setForm((f) => ({ ...f, podeEncaminharChamados: e.target.checked }))} className="rounded border-zinc-600 bg-zinc-800 text-amber-500" />
                    Encaminhar
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Valor máx. autorizar (R$)</label>
                  <input type="number" step="0.01" min="0" value={form.valorMaximoAutorizar} onChange={(e) => setForm((f) => ({ ...f, valorMaximoAutorizar: e.target.value }))} placeholder="Opcional" className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
              </div>
              <Input label="Senha" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
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
      {liberacoesModalUser && (
        <LiberacoesModal
          user={liberacoesModalUser}
          onClose={() => setLiberacoesModalUser(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
