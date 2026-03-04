"use client";

import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

type Cliente = { id: string; name: string; status?: string };
type CurvaABCRow = {
  cod_pessoa: number;
  nom_pessoa: string;
  nivel_curva_abc: string | null;
};

export function CurvaABCForm({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [codPessoa, setCodPessoa] = useState("");
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [resultados, setResultados] = useState<CurvaABCRow[]>([]);

  const handleBuscar = async () => {
    if (!clienteId) {
      toast.error("Selecione o cliente");
      return;
    }
    setLoadingBusca(true);
    setResultados([]);
    try {
      const params = new URLSearchParams({ clientId: clienteId });
      if (codPessoa.trim()) params.set("cod_pessoa", codPessoa.trim());
      if (busca.trim()) params.set("busca", busca.trim());
      const res = await fetch(`/api/tools/curva-abc/buscar?${params.toString()}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setResultados(data);
        if (data.length === 0) toast.info("Nenhum resultado encontrado");
      } else {
        toast.error(data.error ?? "Erro ao buscar Curva ABC");
        setResultados([]);
      }
    } catch {
      toast.error("Erro ao buscar Curva ABC");
      setResultados([]);
    } finally {
      setLoadingBusca(false);
    }
  };

  const showClienteDropdown = clientes.length > 1;

  return (
    <div className="max-w-full space-y-6">
      <header className="border-b border-zinc-700/50 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Curva ABC</h1>
        <p className="mt-1 text-sm text-zinc-500">Consultar nível na Curva ABC por cliente (cadastro)</p>
      </header>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
        {showClienteDropdown && (
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Cliente ativo</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-[140px]">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Código (cod_pessoa)</label>
          <input
            type="text"
            value={codPessoa}
            onChange={(e) => setCodPessoa(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            placeholder="Opcional"
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Nome do cliente</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            placeholder="Filtrar por nome"
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>
        <Button onClick={handleBuscar} disabled={loadingBusca} isLoading={loadingBusca} className="gap-2">
          <IconSearch size={18} strokeWidth={2} />
          Buscar
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700/50">
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Código</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Nome</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Nível Curva ABC</th>
            </tr>
          </thead>
          <tbody>
            {resultados.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                  {loadingBusca ? "Buscando..." : "Selecione o cliente e clique em Buscar"}
                </td>
              </tr>
            ) : (
              resultados.map((r, i) => (
                <tr key={i} className="border-b border-zinc-700/30 hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5 font-mono text-zinc-300">{r.cod_pessoa}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{r.nom_pessoa}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        r.nivel_curva_abc === "A"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : r.nivel_curva_abc === "B"
                            ? "bg-amber-500/20 text-amber-400"
                            : r.nivel_curva_abc === "C"
                              ? "bg-zinc-500/20 text-zinc-300"
                              : "bg-zinc-700/50 text-zinc-500"
                      }`}
                    >
                      {r.nivel_curva_abc ?? "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
