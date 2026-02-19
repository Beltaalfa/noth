"use client";

import { useState, useEffect, useCallback } from "react";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import type { SortDirection } from "@/components/ui/Table";

type Log = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
};

export default function LogsPage() {
  const [data, setData] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
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
      [r.action, r.entity, r.details, r.user?.name, r.user?.email].some((v) =>
        String(v ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      )
  );
  const getSortVal = (r: Log, k: string) => {
    if (k === "user") return `${r.user?.name ?? ""} ${r.user?.email ?? ""}`;
    return String((r as Record<string, unknown>)[k] ?? "");
  };
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
    const offset = (page - 1) * pageSize;
    const res = await fetch(`/api/admin/logs?limit=${pageSize}&offset=${offset}`);
    if (res.ok) {
      const json = await res.json();
      setData(json.logs);
      setTotal(json.total ?? 0);
    }
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Logs / Auditoria</h1>
      <div className="mb-4">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por ação, entidade, usuário, detalhes..." />
      </div>
      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : (
        <Table<Log>
          columns={[
            { key: "createdAt", header: "Data", sortable: true, render: (r) => new Date(r.createdAt).toLocaleString("pt-BR") },
            { key: "user", header: "Usuário", sortable: true, render: (r) => r.user ? `${r.user.name} (${r.user.email})` : "-" },
            { key: "action", header: "Ação", sortable: true },
            { key: "entity", header: "Entidade", sortable: true },
            { key: "entityId", header: "ID", render: (r) => r.entityId ?? "-" },
            { key: "details", header: "Detalhes", sortable: true, render: (r) => r.details ?? "-" },
          ]}
          data={sortedData}
          keyExtractor={(r) => r.id}
          emptyMessage="Nenhum log registrado."
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
    </div>
  );
}
