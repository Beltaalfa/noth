"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { IconReport } from "@tabler/icons-react";

type Report = {
  id: string;
  name: string;
  slug: string;
  clientId: string;
  client: { name: string; logoUrl: string | null };
};

export default function RelatoriosPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hub/relatorios")
      .then((r) => (r.ok ? r.json() : []))
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-zinc-500">Carregando...</p>;
  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <h1 className="text-2xl font-bold text-zinc-100">Relatórios</h1>
        <p className="text-zinc-500 mt-2">Você não tem relatórios liberados.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Relatórios</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link
            key={r.id}
            href={`/relatorios/${r.slug}`}
            className="flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800 overflow-hidden">
              {r.client.logoUrl ? (
                <img src={r.client.logoUrl} alt={r.client.name} className="h-10 w-10 object-contain" />
              ) : (
                <IconReport size={24} strokeWidth={2} className="text-zinc-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-100 truncate">{r.name}</p>
              <p className="text-sm text-zinc-500 truncate">{r.client.name}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
