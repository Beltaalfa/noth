"use client";

import { useState } from "react";

const MOCK_EMPRESAS = [
  { cod_empresa: 1, nom_fantasia: "Posto Centro" },
  { cod_empresa: 2, nom_fantasia: "Posto Sul" },
  { cod_empresa: 3, nom_fantasia: "Posto Norte" },
];

const MOCK_PRODUTOS = [
  { cod_item: 10, des_item: "Gasolina Comum" },
  { cod_item: 20, des_item: "Diesel S10" },
  { cod_item: 30, des_item: "Etanol" },
];

const MOCK_TIPOS = [
  { ind_tipo: "DI", nome_tipo_forma_pagamento: "Dinheiro" },
  { ind_tipo: "NP", nome_tipo_forma_pagamento: "Nota promissória" },
  { ind_tipo: "CC", nome_tipo_forma_pagamento: "Cartão de crédito" },
];

export function PreviewCadastroDescontoForm() {
  const [clienteJaCadastrado, setClienteJaCadastrado] = useState<"sim" | "nao">("nao");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Modo: negociações separadas (um box por empresa) ou mesma negociação (várias empresas, um grid)
  const [modoMultiEmpresa, setModoMultiEmpresa] = useState<"separadas" | "mesma">("separadas");
  // Empresas adicionadas para negociação separada (cada uma com seu box)
  const [empresasSeparadas, setEmpresasSeparadas] = useState<number[]>([]);
  // Empresas selecionadas para "mesma negociação" (validação de preço bomba igual)
  const [empresasMesmaNegociacao, setEmpresasMesmaNegociacao] = useState<number[]>([]);
  // Por empresa (para modo separadas): { combustiveis, tiposPorProduto }
  const [porEmpresa, setPorEmpresa] = useState<
    Record<number, { combustiveis: number[]; tiposPorProduto: Record<number, string[]> }>
  >({});
  // Para mesma negociação: combustíveis e tipos por produto
  const [combustiveisMesma, setCombustiveisMesma] = useState<number[]>([]);
  const [tiposPorProdutoMesma, setTiposPorProdutoMesma] = useState<Record<number, string[]>>({});
  // Simular popup "Preço bomba diferente"
  const [showPopupErroBomba, setShowPopupErroBomba] = useState(false);

  const adicionarEmpresaSeparada = (cod: number) => {
    if (!empresasSeparadas.includes(cod)) setEmpresasSeparadas((e) => [...e, cod]);
    setPorEmpresa((p) => ({ ...p, [cod]: { combustiveis: [], tiposPorProduto: {} } }));
  };
  const removerEmpresaSeparada = (cod: number) => {
    setEmpresasSeparadas((e) => e.filter((x) => x !== cod));
    setPorEmpresa((p) => {
      const next = { ...p };
      delete next[cod];
      return next;
    });
  };
  const toggleCombustivelSeparada = (codEmpresa: number, codItem: number) => {
    setPorEmpresa((p) => {
      const cur = p[codEmpresa] ?? { combustiveis: [], tiposPorProduto: {} };
      const combustiveis = cur.combustiveis.includes(codItem)
        ? cur.combustiveis.filter((x) => x !== codItem)
        : [...cur.combustiveis, codItem];
      return { ...p, [codEmpresa]: { ...cur, combustiveis } };
    });
  };
  const toggleTipoSeparada = (codEmpresa: number, codItem: number, indTipo: string) => {
    setPorEmpresa((p) => {
      const cur = p[codEmpresa] ?? { combustiveis: [], tiposPorProduto: {} };
      const tipos = cur.tiposPorProduto[codItem] ?? [];
      const nextTipos = tipos.includes(indTipo)
        ? tipos.filter((t) => t !== indTipo)
        : [...tipos, indTipo];
      return {
        ...p,
        [codEmpresa]: {
          ...cur,
          tiposPorProduto: { ...cur.tiposPorProduto, [codItem]: nextTipos },
        },
      };
    });
  };

  const toggleEmpresaMesma = (cod: number) => {
    setEmpresasMesmaNegociacao((e) =>
      e.includes(cod) ? e.filter((x) => x !== cod) : [...e, cod]
    );
  };
  const toggleCombustivelMesma = (codItem: number) => {
    setCombustiveisMesma((c) =>
      c.includes(codItem) ? c.filter((x) => x !== codItem) : [...c, codItem]
    );
  };
  const toggleTipoMesma = (codItem: number, indTipo: string) => {
    setTiposPorProdutoMesma((t) => {
      const cur = t[codItem] ?? [];
      const next = cur.includes(indTipo) ? cur.filter((x) => x !== indTipo) : [...cur, indTipo];
      return { ...t, [codItem]: next };
    });
  };

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-4 space-y-6">
      <h2 className="text-lg font-semibold text-zinc-200">
        Cadastro e aprovação de desconto comercial
      </h2>

      {/* Cliente já tem cadastro? */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-zinc-400">Cliente já tem cadastro?</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="preview-ja-cadastro"
              checked={clienteJaCadastrado === "sim"}
              onChange={() => setClienteJaCadastrado("sim")}
              className="rounded border-zinc-500 text-amber-500"
            />
            <span className="text-sm text-zinc-300">Sim</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="preview-ja-cadastro"
              checked={clienteJaCadastrado === "nao"}
              onChange={() => setClienteJaCadastrado("nao")}
              className="rounded border-zinc-500 text-amber-500"
            />
            <span className="text-sm text-zinc-300">Não</span>
          </label>
        </div>
      </div>

      {clienteJaCadastrado === "sim" && (
        <div className="rounded-lg border border-zinc-600/50 bg-zinc-800/50 p-3 space-y-2">
          <label className="block text-xs font-medium text-zinc-400">Buscar por código ou CNPJ/CPF</label>
          <input
            type="text"
            placeholder="Código do cadastro ou CPF/CNPJ"
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
          />
          <p className="text-xs text-zinc-500">Código (para cadastro) — exibido apenas quando &quot;Sim&quot;</p>
        </div>
      )}

      {clienteJaCadastrado === "nao" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-400">Nome (razão social ou nome completo) *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">CEP</label>
            <input
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              placeholder="CEP"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Contato</label>
            <input
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="Nome do contato"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Telefone</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Telefone"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-400">Endereço</label>
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Endereço"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">CPF ou CNPJ</label>
            <input
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder="CPF ou CNPJ"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Inscrição estadual (ou ORG)</label>
            <input
              value={ie}
              onChange={(e) => setIe(e.target.value)}
              placeholder="IE ou ORG"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-400">Volume, combustível, observações</label>
            <input
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Volume que abastece, combustível, observações"
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <p className="sm:col-span-2 text-xs text-zinc-500">Sem campo &quot;Código (para cadastro)&quot; quando cliente não tem cadastro.</p>
        </div>
      )}

      {/* Empresas: modo e seleção */}
      <div className="space-y-3 pt-2 border-t border-zinc-700/50">
        <h3 className="text-sm font-semibold text-zinc-300">Empresas (postos)</h3>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="preview-modo-empresa"
              checked={modoMultiEmpresa === "separadas"}
              onChange={() => setModoMultiEmpresa("separadas")}
              className="rounded border-zinc-500 text-amber-500"
            />
            <span className="text-sm text-zinc-300">Negociação separada (um box por empresa)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="preview-modo-empresa"
              checked={modoMultiEmpresa === "mesma"}
              onChange={() => setModoMultiEmpresa("mesma")}
              className="rounded border-zinc-500 text-amber-500"
            />
            <span className="text-sm text-zinc-300">Mesma negociação (várias empresas, preço bomba igual)</span>
          </label>
        </div>

        {modoMultiEmpresa === "separadas" && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">Adicionar empresa para abrir um box de negociação:</p>
            <div className="flex flex-wrap gap-2">
              {MOCK_EMPRESAS.map((e) => (
                <div key={e.cod_empresa} className="flex items-center gap-2">
                  {empresasSeparadas.includes(e.cod_empresa) ? (
                    <button
                      type="button"
                      onClick={() => removerEmpresaSeparada(e.cod_empresa)}
                      className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm text-red-200"
                    >
                      Remover {e.nom_fantasia}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => adicionarEmpresaSeparada(e.cod_empresa)}
                      className="rounded-lg border border-zinc-600 bg-zinc-700/50 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-600/50"
                    >
                      + {e.nom_fantasia}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {modoMultiEmpresa === "mesma" && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">Marque as empresas para mesma negociação (sistema validará preço de bomba igual):</p>
            <div className="flex flex-wrap gap-3">
              {MOCK_EMPRESAS.map((e) => (
                <label key={e.cod_empresa} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empresasMesmaNegociacao.includes(e.cod_empresa)}
                    onChange={() => toggleEmpresaMesma(e.cod_empresa)}
                    className="rounded border-zinc-500 text-amber-500"
                  />
                  <span className="text-sm text-zinc-300">{e.nom_fantasia}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPopupErroBomba(true)}
              className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200"
            >
              Simular popup: Preço bomba diferente
            </button>
          </div>
        )}
      </div>

      {/* Box por empresa (negociação separada) */}
      {modoMultiEmpresa === "separadas" &&
        empresasSeparadas.map((codEmpresa) => {
          const emp = MOCK_EMPRESAS.find((e) => e.cod_empresa === codEmpresa);
          const dados = porEmpresa[codEmpresa] ?? { combustiveis: [], tiposPorProduto: {} };
          return (
            <div
              key={codEmpresa}
              className="rounded-lg border-2 border-zinc-600 bg-zinc-800/50 p-4 space-y-4"
            >
              <h4 className="text-sm font-semibold text-zinc-300">
                Negociação para {emp?.nom_fantasia ?? codEmpresa}
              </h4>
              <div className="space-y-2">
                <span className="text-xs font-medium text-zinc-400">Produtos (combustíveis)</span>
                <div className="flex flex-wrap gap-3">
                  {MOCK_PRODUTOS.map((c) => (
                    <label key={c.cod_item} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dados.combustiveis.includes(c.cod_item)}
                        onChange={() => toggleCombustivelSeparada(codEmpresa, c.cod_item)}
                        className="rounded border-zinc-500 text-amber-500"
                      />
                      <span className="text-sm text-zinc-300">{c.des_item}</span>
                    </label>
                  ))}
                </div>
              </div>
              {dados.combustiveis.map((codItem) => {
                const prod = MOCK_PRODUTOS.find((p) => p.cod_item === codItem);
                const tipos = dados.tiposPorProduto[codItem] ?? [];
                return (
                  <div
                    key={codItem}
                    className="rounded border border-zinc-600/50 bg-zinc-800/30 p-3 space-y-2"
                  >
                    <p className="text-sm font-medium text-zinc-300">{prod?.des_item}</p>
                    <div className="space-y-1">
                      <span className="text-xs text-zinc-400">Tipo de forma de pagamento</span>
                      <div className="flex flex-wrap gap-3">
                        {MOCK_TIPOS.map((t) => (
                          <label key={t.ind_tipo} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tipos.includes(t.ind_tipo)}
                              onChange={() => toggleTipoSeparada(codEmpresa, codItem, t.ind_tipo)}
                              className="rounded border-zinc-500 text-amber-500"
                            />
                            <span className="text-sm text-zinc-300">{t.nome_tipo_forma_pagamento}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {tipos.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm table-fixed">
                          <thead>
                            <tr className="text-left text-zinc-400 border-b border-zinc-600">
                              <th className="pb-1.5 pr-2">Tipo pagamento</th>
                              <th className="pb-1.5 pr-2 w-[100px]">Valor bomba</th>
                              <th className="pb-1.5 pr-2 w-[100px]">Negociação</th>
                              <th className="pb-1.5 w-[100px]">Valor combinado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tipos.map((indTipo) => {
                              const t = MOCK_TIPOS.find((x) => x.ind_tipo === indTipo);
                              return (
                                <tr key={indTipo} className="border-b border-zinc-700/50">
                                  <td className="py-1.5 pr-2 text-zinc-300">{t?.nome_tipo_forma_pagamento}</td>
                                  <td className="py-1.5 pr-2 text-zinc-300">5,00</td>
                                  <td className="py-1.5 pr-2">
                                    <input
                                      type="text"
                                      placeholder="0,00"
                                      className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-100 text-sm"
                                    />
                                  </td>
                                  <td className="py-1.5 text-zinc-300">—</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

      {/* Mesma negociação: um bloco de produtos + tipos + grid */}
      {modoMultiEmpresa === "mesma" && empresasMesmaNegociacao.length > 0 && (
        <div className="rounded-lg border-2 border-zinc-600 bg-zinc-800/50 p-4 space-y-4">
          <h4 className="text-sm font-semibold text-zinc-300">
            Mesma negociação para {empresasMesmaNegociacao.map((c) => MOCK_EMPRESAS.find((e) => e.cod_empresa === c)?.nom_fantasia).join(", ")}
          </h4>
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Produtos (combustíveis)</span>
            <div className="flex flex-wrap gap-3">
              {MOCK_PRODUTOS.map((c) => (
                <label key={c.cod_item} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={combustiveisMesma.includes(c.cod_item)}
                    onChange={() => toggleCombustivelMesma(c.cod_item)}
                    className="rounded border-zinc-500 text-amber-500"
                  />
                  <span className="text-sm text-zinc-300">{c.des_item}</span>
                </label>
              ))}
            </div>
          </div>
          {combustiveisMesma.map((codItem) => {
            const prod = MOCK_PRODUTOS.find((p) => p.cod_item === codItem);
            const tipos = tiposPorProdutoMesma[codItem] ?? [];
            return (
              <div
                key={codItem}
                className="rounded border border-zinc-600/50 bg-zinc-800/30 p-3 space-y-2"
              >
                <p className="text-sm font-medium text-zinc-300">{prod?.des_item}</p>
                <div className="flex flex-wrap gap-3">
                  {MOCK_TIPOS.map((t) => (
                    <label key={t.ind_tipo} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tipos.includes(t.ind_tipo)}
                        onChange={() => toggleTipoMesma(codItem, t.ind_tipo)}
                        className="rounded border-zinc-500 text-amber-500"
                      />
                      <span className="text-sm text-zinc-300">{t.nome_tipo_forma_pagamento}</span>
                    </label>
                  ))}
                </div>
                {tipos.length > 0 && (
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="text-left text-zinc-400 border-b border-zinc-600">
                        <th className="pb-1.5 pr-2">Tipo pagamento</th>
                        <th className="pb-1.5 pr-2 w-[100px]">Valor bomba</th>
                        <th className="pb-1.5 pr-2 w-[100px]">Negociação</th>
                        <th className="pb-1.5 w-[100px]">Valor combinado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tipos.map((indTipo) => {
                        const t = MOCK_TIPOS.find((x) => x.ind_tipo === indTipo);
                        return (
                          <tr key={indTipo} className="border-b border-zinc-700/50">
                            <td className="py-1.5 pr-2 text-zinc-300">{t?.nome_tipo_forma_pagamento}</td>
                            <td className="py-1.5 pr-2 text-zinc-300">5,00</td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="text"
                                placeholder="0,00"
                                className="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-100 text-sm"
                              />
                            </td>
                            <td className="py-1.5 text-zinc-300">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Popup simulado: Preço bomba diferente */}
      {showPopupErroBomba && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowPopupErroBomba(false)}
        >
          <div
            className="rounded-lg border border-red-500/50 bg-zinc-800 p-4 max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-red-300 mb-2">Preço de bomba diferente</h4>
            <p className="text-sm text-zinc-300 mb-3">
              Os valores de bomba não são iguais em todas as empresas selecionadas. Não é possível usar a mesma negociação.
            </p>
            <ul className="text-sm text-zinc-400 space-y-1 mb-4">
              <li><strong className="text-zinc-200">Gasolina Comum</strong> — Posto Centro: R$ 5,00; Posto Sul: R$ 5,20</li>
              <li><strong className="text-zinc-200">Diesel S10</strong> — Posto Centro: R$ 4,80; Posto Sul: R$ 4,80</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowPopupErroBomba(false)}
              className="rounded-lg bg-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-500"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500 pt-2 border-t border-zinc-700/50">
        Campos como Forma de pagamento (POP), Volume estimado, Classe ABC e Valor do desconto ficam abaixo deste bloco, como hoje.
      </p>
    </div>
  );
}
