"use client";

import { useState, useEffect, useCallback } from "react";
import { Table } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";

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

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Logs / Auditoria</h1>
      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : (
        <Table<Log>
          columns={[
            { key: "createdAt", header: "Data", render: (r) => new Date(r.createdAt).toLocaleString("pt-BR") },
            { key: "user", header: "Usuário", render: (r) => r.user ? `${r.user.name} (${r.user.email})` : "-" },
            { key: "action", header: "Ação" },
            { key: "entity", header: "Entidade" },
            { key: "entityId", header: "ID", render: (r) => r.entityId ?? "-" },
            { key: "details", header: "Detalhes", render: (r) => r.details ?? "-" },
          ]}
          data={data}
          keyExtractor={(r) => r.id}
          emptyMessage="Nenhum log registrado."
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
