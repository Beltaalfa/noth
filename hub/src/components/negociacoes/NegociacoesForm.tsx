"use client";

import { useState, useEffect, useCallback } from "react";
import { IconSearch } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";

type Cliente = { id: string; name: string };
type Empresa = { cod_empresa: number; nom_fantasia: string };
type Negociacao = {
  nom_fantasia: string;
  cod_pessoa: number;
  nom_pessoa: string;
  num_cnpj_cpf: string;
  cod_item: number;
  des_item: string;
  cod_condicao_pagamento: unknown;
  des_forma_pagto: string;
  preco_fixo: number;
  preco_negociado: number;
  desconto_reais: number;
  desconto_centavos: number;
  preco_final: number;
  data_inicio_negociacao: string | null;
};

function formatMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

export function NegociacoesForm({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [codEmpresa, setCodEmpresa] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [resultados, setResultados] = useState<Negociacao[]>([]);

  const fetchEmpresas = useCallback(async () => {
    if (!clienteId) {
      setEmpresas([]);
      setCodEmpresa("");
      return;
    }
    setLoadingEmpresas(true);
    try {
      const res = await fetch(`/api/tools/negociacoes/empresas?clienteId=${encodeURIComponent(clienteId)}`);
      if (res.ok) {
        const data = await res.json();
        setEmpresas(Array.isArray(data) ? data : []);
        setCodEmpresa("");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Erro ao carregar empresas");
        setEmpresas([]);
      }
    } catch {
      toast.error("Erro ao carregar empresas");
      setEmpresas([]);
    } finally {
      setLoadingEmpresas(false);
    }
  }, [clienteId]);

  useEffect(() => {
    setClienteId(clientes[0]?.id ?? "");
  }, [clientes]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas, clienteId]);

  const handleBuscar = async () => {
    if (!clienteId) {
      toast.error("Selecione o cliente");
      return;
    }
    if (!codEmpresa) {
      toast.error("Selecione a empresa");
      return;
    }
    if (!busca.trim()) {
      toast.error("Digite o CNPJ, código ou nome do cliente");
      return;
    }
    setLoadingBusca(true);
    setResultados([]);
    try {
      const res = await fetch("/api/tools/negociacoes/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          codEmpresa: Number(codEmpresa),
          busca: busca.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setResultados(data);
        if (data.length === 0) toast.info("Nenhum resultado encontrado");
      } else {
        toast.error(data.error ?? "Erro ao buscar");
        setResultados([]);
      }
    } catch {
      toast.error("Erro ao buscar negociações");
      setResultados([]);
    } finally {
      setLoadingBusca(false);
    }
  };

  const showClienteDropdown = clientes.length > 1;

  return (
    <div className="max-w-full space-y-6">
      <header className="border-b border-zinc-700/50 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Negociações</h1>
        <p className="mt-1 text-sm text-zinc-500">Buscar negociações ativas por cliente e produto</p>
      </header>

      {/* Topbar */}
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
        <div className="min-w-[220px]">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Empresa (tab_empresa)</label>
          <select
            value={codEmpresa}
            onChange={(e) => setCodEmpresa(e.target.value)}
            disabled={loadingEmpresas}
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          >
            <option value="">Selecione...</option>
            {empresas.map((e) => (
              <option key={e.cod_empresa} value={e.cod_empresa}>
                {e.cod_empresa} - {e.nom_fantasia}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[240px] flex-1">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Cliente (CNPJ, código ou nome)</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            placeholder="CNPJ, código ou nome"
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
          />
        </div>
        <Button onClick={handleBuscar} disabled={loadingBusca} isLoading={loadingBusca} className="gap-2">
          <IconSearch size={18} strokeWidth={2} />
          Buscar
        </Button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700/50">
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Empresa</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Cod Pessoa</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Cliente</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">CNPJ/CPF</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Produto</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-zinc-400">Forma Pgto</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-400">Preço Negociado</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-400">Negociação</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-400">Desconto (R$)</th>
            </tr>
          </thead>
          <tbody>
            {resultados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  {loadingBusca ? "Buscando..." : "Preencha os campos e clique em Buscar"}
                </td>
              </tr>
            ) : (
              resultados.map((r, i) => (
                <tr key={i} className="border-b border-zinc-700/30 hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5 text-zinc-200">{r.nom_fantasia}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{r.cod_pessoa}</td>
                  <td className="px-4 py-2.5 text-zinc-200">{r.nom_pessoa}</td>
                  <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{r.num_cnpj_cpf}</td>
                  <td className="px-4 py-2.5 text-zinc-300">
                    {r.cod_item} - {r.des_item}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">{r.des_forma_pagto}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-200">{formatMoney(r.preco_negociado)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-200">{formatMoney(r.preco_fixo)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-medium ${r.desconto_reais >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatMoney(r.desconto_reais)}
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
