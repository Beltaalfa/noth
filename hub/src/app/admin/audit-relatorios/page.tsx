"use client";

import { useState, useEffect, useCallback } from "react";
import { IconLink, IconCalendar, IconRefresh, IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AuditRelatoriosPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [from, setFrom] = useState(formatDate(startOfMonth));
  const [to, setTo] = useState(formatDate(now));
  const [data, setData] = useState<{
    resumo: { totalRelatorios: number; acessosNoPeriodo: number; acessosNoDia: number; acessosNaSemana: number; acessosNoMes: number };
    usuariosMaisAcessam: { userId: string; name: string; email: string; count: number }[];
    relatoriosMaisAcessados: { toolId: string; toolName: string; count: number }[];
    detalhes: { userName: string; userEmail: string; toolName: string; createdAt: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/audit-relatorios?from=${from}&to=${to}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Auditoria de Relatórios</h1>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm"
        />
        <span className="text-zinc-500">até</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm"
        />
        <Button onClick={fetchData} className="gap-2">
          Buscar
        </Button>
        <Button variant="secondary" onClick={fetchData} className="gap-2">
          <IconRefresh size={18} strokeWidth={2} />
          Atualizar
        </Button>
        {data && data.detalhes.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => {
              const headers = ["Data/Hora", "Usuário", "Email", "Relatório"];
              const rows = data.detalhes.map((d) => [
                new Date(d.createdAt).toLocaleString("pt-BR"),
                d.userName,
                d.userEmail,
                d.toolName,
              ]);
              const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\n");
              const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `auditoria-relatorios-${from}-${to}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="gap-2"
          >
            <IconDownload size={18} strokeWidth={2} />
            Exportar CSV/Excel
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-zinc-500">Carregando...</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <IconLink size={20} strokeWidth={2} />
                <span className="text-sm">Relatórios acessados</span>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{data.resumo.totalRelatorios}</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <IconCalendar size={20} strokeWidth={2} />
                <span className="text-sm">Acessos no período</span>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{data.resumo.acessosNoPeriodo}</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center gap-2 text-amber-400/80 mb-1">
                <IconCalendar size={20} strokeWidth={2} />
                <span className="text-sm">Acessos na semana</span>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{data.resumo.acessosNaSemana}</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center gap-2 text-green-400/80 mb-1">
                <IconCalendar size={20} strokeWidth={2} />
                <span className="text-sm">Acessos hoje</span>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{data.resumo.acessosNoDia}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Usuários que mais acessam</h2>
              {data.usuariosMaisAcessam.length === 0 ? (
                <p className="text-zinc-500 text-sm">Nenhum acesso no período</p>
              ) : (
                <ul className="space-y-3">
                  {data.usuariosMaisAcessam.map((u) => (
                    <li key={u.userId} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                      <span className="text-zinc-200 truncate">{u.name}</span>
                      <span className="text-zinc-400 font-medium shrink-0 ml-2">{u.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Relatórios mais acessados</h2>
              {data.relatoriosMaisAcessados.length === 0 ? (
                <p className="text-zinc-500 text-sm">Nenhum acesso no período</p>
              ) : (
                <ul className="space-y-3">
                  {data.relatoriosMaisAcessados.map((r) => (
                    <li key={r.toolId} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                      <span className="text-zinc-200 truncate">{r.toolName}</span>
                      <span className="text-zinc-400 font-medium shrink-0 ml-2">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Quem acessou o quê (últimos 100)</h2>
            {data.detalhes.length === 0 ? (
              <p className="text-zinc-500 text-sm">Nenhum acesso no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-400 border-b border-zinc-800">
                      <th className="py-2 pr-4">Data/Hora</th>
                      <th className="py-2 pr-4">Usuário</th>
                      <th className="py-2 pr-4">Relatório</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.detalhes.map((d, i) => (
                      <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                        <td className="py-2 pr-4 text-zinc-500">
                          {new Date(d.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2 pr-4 text-zinc-200">
                          {d.userName} ({d.userEmail})
                        </td>
                        <td className="py-2 text-zinc-200">{d.toolName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-zinc-500">Erro ao carregar dados.</p>
      )}
    </div>
  );
}
