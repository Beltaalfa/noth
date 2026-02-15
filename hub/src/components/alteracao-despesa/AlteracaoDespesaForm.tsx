"use client";

import { useState, useEffect, useCallback } from "react";
import { IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type CentroCusto = { cod_centro_custo: number; des_centro_custo: string };
type TipoDespesa = { cod_tipo_despesa: number; des_tipo_despesa: string };
type Despesa = { seq_despesa: number; codigo: string; descricao: string; label: string };

function parseSequencias(val: string): number[] {
  return val
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

export function AlteracaoDespesaForm() {
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [seqInput, setSeqInput] = useState("");
  const [alterarCentro, setAlterarCentro] = useState(false);
  const [alterarTipo, setAlterarTipo] = useState(false);
  const [alterarObservacao, setAlterarObservacao] = useState(false);
  const [codCentroCusto, setCodCentroCusto] = useState<string>("");
  const [codTipoDespesa, setCodTipoDespesa] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [modalConfirm, setModalConfirm] = useState(false);

  const handleSeqInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^\d,]/g, "");
    setSeqInput(v);
  };

  const selectedSeq = parseSequencias(seqInput);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    try {
      const [ccRes, tdRes, desRes] = await Promise.all([
        fetch("/api/tools/despesa/centros-custo"),
        fetch("/api/tools/despesa/tipos-despesa"),
        fetch("/api/tools/despesa/despesas"),
      ]);
      const parseJson = async (res: Response) => {
        try {
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        } catch {
          return [];
        }
      };
      setCentros(ccRes.ok ? await parseJson(ccRes) : []);
      setTipos(tdRes.ok ? await parseJson(tdRes) : []);
      setDespesas(desRes.ok ? await parseJson(desRes) : []);
      setSeqInput("");
      setAlterarCentro(false);
      setAlterarTipo(false);
      setAlterarObservacao(false);
      setCodCentroCusto("");
      setCodTipoDespesa("");
      setObservacao("");
    } catch {
      setCentros([]);
      setTipos([]);
      setDespesas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const temCentro = alterarCentro && codCentroCusto !== "";
  const temTipo = alterarTipo && codTipoDespesa !== "";
  const temObs = alterarObservacao && observacao.trim() !== "";
  const podeAplicar = selectedSeq.length > 0 && (temCentro || temTipo || temObs);

  const handleAplicar = async () => {
    if (!podeAplicar) return;
    setModalConfirm(false);
    setAplicando(true);
    try {
      const body: {
        seqDespesas: number[];
        codCentroCusto?: number;
        codTipoDespesa?: number;
        observacao?: string;
      } = { seqDespesas: selectedSeq };
      if (temCentro) body.codCentroCusto = Number(codCentroCusto);
      if (temTipo) body.codTipoDespesa = Number(codTipoDespesa);
      if (temObs) body.observacao = observacao.trim();

      const res = await fetch("/api/tools/despesa/aplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`${data.afetados?.total ?? selectedSeq.length} despesas atualizadas com sucesso.`);
        setSeqInput("");
        setAlterarCentro(false);
        setAlterarTipo(false);
        setAlterarObservacao(false);
        setCodCentroCusto("");
        setCodTipoDespesa("");
        setObservacao("");
      } else {
        toast.error(data.error ?? "Erro ao aplicar alterações");
      }
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header className="border-b border-zinc-700/50 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Ajuste de Despesas
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Banco de dados PMG</p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 px-6 py-12 text-center text-zinc-500">
          Carregando dados...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Despesas */}
          <section className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-400">
              Despesas
            </h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Sequência
              </label>
              <input
                type="text"
                value={seqInput}
                onChange={handleSeqInput}
                placeholder="Ex: 1, 2, 3 ou 1,2,3"
                className="w-full max-w-md px-3 py-2 rounded-lg border border-zinc-600/80 bg-zinc-800/50 text-zinc-100 text-sm transition-colors placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
              />
              <p className="mt-1.5 text-xs text-zinc-500">Apenas números e vírgulas</p>
            </div>
          </section>

          {/* Alterações a aplicar */}
          <section className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-5">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">
              Alterações a aplicar
            </h2>
            <p className="mb-4 text-xs text-zinc-500">
              Marque os campos que deseja alterar e preencha os valores
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-4">
                <input
                  type="checkbox"
                  id="cb-centro"
                  checked={alterarCentro}
                  onChange={(e) => setAlterarCentro(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-0 focus:ring-offset-zinc-900"
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor="cb-centro" className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Centro de custo (rateio)
                  </label>
                  <select
                    value={codCentroCusto}
                    onChange={(e) => setCodCentroCusto(e.target.value)}
                    disabled={!alterarCentro}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-600/80 bg-zinc-800/50 text-zinc-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
                  >
                    <option value="">Selecione...</option>
                    {centros.map((c) => (
                      <option key={c.cod_centro_custo} value={c.cod_centro_custo}>
                        {c.cod_centro_custo} - {c.des_centro_custo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-4">
                <input
                  type="checkbox"
                  id="cb-tipo"
                  checked={alterarTipo}
                  onChange={(e) => setAlterarTipo(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-0 focus:ring-offset-zinc-900"
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor="cb-tipo" className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Tipo de despesa
                  </label>
                  <select
                    value={codTipoDespesa}
                    onChange={(e) => setCodTipoDespesa(e.target.value)}
                    disabled={!alterarTipo}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-600/80 bg-zinc-800/50 text-zinc-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
                  >
                    <option value="">Selecione...</option>
                    {tipos.map((t) => (
                      <option key={t.cod_tipo_despesa} value={t.cod_tipo_despesa}>
                        {t.cod_tipo_despesa} - {t.des_tipo_despesa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-4">
                <input
                  type="checkbox"
                  id="cb-obs"
                  checked={alterarObservacao}
                  onChange={(e) => setAlterarObservacao(e.target.checked)}
                  className="mt-1.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:ring-offset-0 focus:ring-offset-zinc-900"
                />
                <div className="flex-1 min-w-0">
                  <label htmlFor="cb-obs" className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Observação
                  </label>
                  <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    disabled={!alterarObservacao}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-zinc-100 text-sm placeholder:text-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/50"
                    placeholder="Campo livre..."
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-zinc-700/50">
              <Button
                onClick={() => setModalConfirm(true)}
                disabled={!podeAplicar || aplicando}
                isLoading={aplicando}
                className="gap-2"
              >
                <IconCheck size={18} strokeWidth={2} />
                Aplicar alterações
              </Button>
            </div>
          </section>
        </div>
      )}

      <Modal
        isOpen={modalConfirm}
        onClose={() => setModalConfirm(false)}
        title="Confirmar"
      >
        <p className="text-zinc-300 mb-4">
          Você vai atualizar {selectedSeq.length} despesa(s). Confirmar?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalConfirm(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAplicar} isLoading={aplicando}>
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
