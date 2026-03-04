"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { IconPlus, IconPaperclip, IconSend, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { EncaminharModal } from "./EncaminharModal";
import { TIPO_CADASTRO_DESCONTO_COMERCIAL } from "@/lib/schemas/helpdesk";

type Cliente = { id: string; name: string };
type Ticket = {
  id: string;
  numero?: number | null;
  subject: string | null;
  status: string;
  priority?: string | null;
  creator: { id: string; name: string };
  client: { id: string; name: string };
  nivelCurvaAbc?: string | null;
  assigneeUser?: {
    id: string;
    name: string;
    primaryGroup?: { id: string; name: string } | null;
    primarySector?: { id: string; name: string; group?: { name: string } } | null;
  } | null;
  group?: { id: string; name: string } | null;
  sector?: { id: string; name: string } | null;
  tipoSolicitacao?: { id: string; nome: string } | null;
  _count: { messages: number };
  updatedAt: string;
  createdAt: string;
  slaLimitHours?: number | null;
};
type Summary = {
  abertos?: number;
  emAndamento?: number;
  aguardandoAprovacao?: number;
  reprovados?: number;
  encerrados?: number;
  agendado?: number;
  aguardandoAtendimento?: number;
  emAtendimento?: number;
  aguardandoFeedback?: number;
  concluido?: number;
  custoAguardandoAprovacao?: number;
};
type Message = {
  id: string;
  content: string;
  user: { id: string; name: string };
  attachments: { id: string; filename: string; storagePath: string }[];
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  closed: "Fechado",
  pending_approval: "Aguardando aprovação",
  rejected: "Reprovado",
  in_approval: "Em análise",
  approved: "Aprovado",
  cancelled: "Cancelado",
  agendado_com_usuario: "Agendado",
  aguardando_atendimento: "Aguardando atendimento",
  em_atendimento: "Em atendimento",
  aguardando_feedback_usuario: "Aguardando seu feedback",
  encaminhado_operador: "Encaminhado",
  indisponivel_atendimento: "Indisponível",
  reaberto: "Reaberto",
  retornado_usuario: "Retornado",
  custo_aguardando_aprovacao: "Custo aguardando aprovação",
  autorizado: "Autorizado",
  negado: "Negado",
  atualizado: "Atualizado",
  concluido: "Concluído",
  aguardando_aprovacao_proprietarios: "Aguardando aprovação (2 proprietários)",
};
const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export function MeusChamadosPage({ clientes }: { clientes: Cliente[] }) {
  useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<{
    id: string;
    messages: Message[];
    subject: string | null;
    status: string;
    creator: { id: string };
    clientId?: string;
    client?: { id: string; name: string };
    nivelCurvaAbc?: string | null;
  } | null>(null);
  const [showEncaminhar, setShowEncaminhar] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(clientes[0]?.id ?? "");
  const [tabFilter, setTabFilter] = useState<"abertos" | "encerrados">("abertos");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketClientId, setNewTicketClientId] = useState(clientes[0]?.id ?? "");
  const [assigneeType, setAssigneeType] = useState<"user" | "group" | "sector">("group");
  const [assigneeId, setAssigneeId] = useState("");
  const [subject, setSubject] = useState("");
  const [newTicketContent, setNewTicketContent] = useState("");
  const [tipoSolicitacaoId, setTipoSolicitacaoId] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<string>("");
  const [destinatarios, setDestinatarios] = useState<{
    users: { id: string; name: string; type: string }[];
    groups: { id: string; name: string; type: string }[];
    sectors: { id: string; name: string; type: string }[];
  } | null>(null);
  type TipoSolicitacaoItem = { id: string; nome: string; parent_nome: string | null; group_id: string | null; sector_id: string | null };
  const [tiposSolicitacaoAll, setTiposSolicitacaoAll] = useState<TipoSolicitacaoItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [formDataCadastro, setFormDataCadastro] = useState({
    nome: "",
    codigo: "",
    cep: "",
    endereco: "",
    contato: "",
    telefone: "",
    email: "",
    cpfCnpj: "",
    inscricaoEstadual: "",
    observacoes: "",
    formaPagamentoCod: undefined as number | undefined,
    formaPagamentoNome: "",
    volumeEstimadoLitros: "" as string | number,
    classeABC: "",
  });
  const [formasPagamentoOptions, setFormasPagamentoOptions] = useState<{ cod_forma_pagto: number; des_forma_pagto: string }[]>([]);
  const [clienteJaCadastrado, setClienteJaCadastrado] = useState<"" | "sim" | "nao">("");
  const [buscaCadastro, setBuscaCadastro] = useState("");
  const [loadingBuscaCadastro, setLoadingBuscaCadastro] = useState(false);
  const [cadastroEncontrado, setCadastroEncontrado] = useState<{ cod_pessoa: number; nom_pessoa: string; num_cnpj_cpf: string } | null>(null);
  const [loadingNivelCurvaAbc, setLoadingNivelCurvaAbc] = useState(false);
  const [modoMultiEmpresa, setModoMultiEmpresa] = useState<"separadas" | "mesma">("separadas");
  const [empresasSeparadas, setEmpresasSeparadas] = useState<number[]>([]);
  const [empresasMesmaNegociacao, setEmpresasMesmaNegociacao] = useState<number[]>([]);
  type NegociacaoEmpresa = { combustiveisSelecionados: number[]; tiposPorProduto: Record<number, string[]>; gridDescontos: Record<string, string>; precosBomba: Record<number, number>; volumePorProduto: Record<number, string> };
  const [negociacoesPorEmpresa, setNegociacoesPorEmpresa] = useState<Record<number, NegociacaoEmpresa>>({});
  const [combustiveisMesma, setCombustiveisMesma] = useState<number[]>([]);
  const [tiposPorProdutoMesma, setTiposPorProdutoMesma] = useState<Record<number, string[]>>({});
  const [gridDescontosMesma, setGridDescontosMesma] = useState<Record<string, string>>({});
  const [precosBombaMesma, setPrecosBombaMesma] = useState<Record<number, number>>({});
  const [volumePorProdutoMesma, setVolumePorProdutoMesma] = useState<Record<number, string>>({});
  const [erroPrecoBombaDiferente, setErroPrecoBombaDiferente] = useState<{ des_item: string; valores: { nom_fantasia: string; valor: number }[] }[] | null>(null);
  const [empresasOptions, setEmpresasOptions] = useState<{ cod_empresa: number; nom_fantasia: string }[]>([]);
  const [formasComTipo, setFormasComTipo] = useState<{ cod_forma_pagto: number; ind_tipo: string; nome_tipo_forma_pagamento: string; nome_forma_pagamento: string }[]>([]);
  const [combustiveisOptions, setCombustiveisOptions] = useState<{ cod_item: number; des_item: string }[]>([]);

  const fetchDestinatarios = useCallback(async (cid: string) => {
    if (!cid) return;
    const res = await fetch(`/api/helpdesk/destinatarios?clientId=${cid}&onlyReceivers=true`);
    const data = await res.json();
    if (res.ok) setDestinatarios(data);
    else setDestinatarios(null);
  }, []);

  const fetchTiposSolicitacao = useCallback(async (cid: string) => {
    if (!cid) return;
    const res = await fetch(`/api/helpdesk/tipos?clientId=${cid}`);
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      const ativos = data
        .filter((t: { status?: string }) => t.status === "A")
        .map((t: { id: string; nome: string; parent_nome?: string | null; group_id?: string | null; sector_id?: string | null }) => ({
          id: t.id,
          nome: t.nome,
          parent_nome: t.parent_nome ?? null,
          group_id: t.group_id ?? null,
          sector_id: t.sector_id ?? null,
        }));
      setTiposSolicitacaoAll(ativos);
    } else {
      setTiposSolicitacaoAll([]);
    }
  }, []);

  useEffect(() => {
    if (showNewTicket && newTicketClientId) {
      fetchDestinatarios(newTicketClientId);
      fetchTiposSolicitacao(newTicketClientId);
    }
  }, [showNewTicket, newTicketClientId, fetchDestinatarios, fetchTiposSolicitacao]);

  const assigneeOptions = destinatarios
    ? [
        ...(destinatarios.users ?? []).map((u: { id: string; name: string; groupIds?: string[]; sectorIds?: string[] }) => ({
          id: u.id,
          name: u.name,
          type: "user" as const,
          groupIds: u.groupIds ?? [],
          sectorIds: u.sectorIds ?? [],
        })),
        ...(destinatarios.groups ?? []).map((g) => ({ id: g.id, name: g.name, type: "group" as const })),
        ...(destinatarios.sectors ?? []).map((s) => ({ id: s.id, name: s.name, type: "sector" as const })),
      ]
    : [];

  const selectedUserOption = assigneeType === "user" ? assigneeOptions.find((o) => o.type === "user" && o.id === assigneeId) : null;
  const userGroupIds = selectedUserOption && "groupIds" in selectedUserOption ? (selectedUserOption as { groupIds: string[] }).groupIds : [];
  const userSectorIds = selectedUserOption && "sectorIds" in selectedUserOption ? (selectedUserOption as { sectorIds: string[] }).sectorIds : [];

  const tiposSolicitacaoFiltered = (() => {
    if (!assigneeId) return [];
    if (assigneeType === "group") return tiposSolicitacaoAll.filter((t) => t.group_id === assigneeId);
    if (assigneeType === "sector") return tiposSolicitacaoAll.filter((t) => t.sector_id === assigneeId);
    if (assigneeType === "user")
      return tiposSolicitacaoAll.filter(
        (t) =>
          (!t.group_id && !t.sector_id) ||
          (t.group_id && userGroupIds.includes(t.group_id)) ||
          (t.sector_id && userSectorIds.includes(t.sector_id))
      );
    return [];
  })();

  useEffect(() => {
    if (!tipoSolicitacaoId) return;
    const allowed = tiposSolicitacaoFiltered.some((t) => t.id === tipoSolicitacaoId);
    if (!allowed) setTipoSolicitacaoId("");
  }, [assigneeType, assigneeId, tipoSolicitacaoId, tiposSolicitacaoFiltered]);

  const selectedTipoNome = tiposSolicitacaoFiltered.find((t) => t.id === tipoSolicitacaoId)?.nome ?? "";
  const isTipoCadastroDesconto = selectedTipoNome === TIPO_CADASTRO_DESCONTO_COMERCIAL;

  useEffect(() => {
    if (!newTicketClientId || !isTipoCadastroDesconto) {
      setFormasPagamentoOptions([]);
      setFormasComTipo([]);
      setEmpresasOptions([]);
      setEmpresasSeparadas([]);
      setEmpresasMesmaNegociacao([]);
      setNegociacoesPorEmpresa({});
      setCombustiveisMesma([]);
      setTiposPorProdutoMesma({});
      setGridDescontosMesma({});
      setPrecosBombaMesma({});
      setErroPrecoBombaDiferente(null);
      setCombustiveisOptions([]);
      return;
    }
    fetch(`/api/tools/negociacoes/formas-pagamento?clientId=${newTicketClientId}`)
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setFormasPagamentoOptions(data) : setFormasPagamentoOptions([])))
      .catch(() => setFormasPagamentoOptions([]));
    fetch(`/api/tools/negociacoes/formas-pagamento-com-tipo?clientId=${newTicketClientId}`)
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setFormasComTipo(data) : setFormasComTipo([])))
      .catch(() => setFormasComTipo([]));
    fetch(`/api/tools/negociacoes/empresas?clientId=${newTicketClientId}`)
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setEmpresasOptions(data) : setEmpresasOptions([])))
      .catch(() => setEmpresasOptions([]));
    fetch(`/api/tools/negociacoes/produtos?clienteId=${newTicketClientId}`)
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setCombustiveisOptions(data) : setCombustiveisOptions([])))
      .catch(() => setCombustiveisOptions([]));
  }, [newTicketClientId, isTipoCadastroDesconto]);

  useEffect(() => {
    if (!newTicketClientId || !cadastroEncontrado) {
      setFormDataCadastro((f) => (f.classeABC ? { ...f, classeABC: "" } : f));
      return;
    }
    let cancelled = false;
    setLoadingNivelCurvaAbc(true);
    fetch(`/api/tools/curva-abc/nivel?clientId=${encodeURIComponent(newTicketClientId)}&cod_pessoa=${cadastroEncontrado.cod_pessoa}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.nivelCurvaAbc) setFormDataCadastro((f) => ({ ...f, classeABC: data.nivelCurvaAbc }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingNivelCurvaAbc(false);
      });
    return () => { cancelled = true; };
  }, [newTicketClientId, cadastroEncontrado?.cod_pessoa]);

  useEffect(() => {
    if (!newTicketClientId || empresasSeparadas.length === 0) return;
    empresasSeparadas.forEach((codEmpresa) => {
      fetch(`/api/tools/negociacoes/preco-bomba?clientId=${newTicketClientId}&codEmpresa=${codEmpresa}`)
        .then((r) => r.json())
        .then((precos) => {
          if (!Array.isArray(precos)) return;
          const map: Record<number, number> = {};
          for (const p of precos) {
            map[Number(p.cod_item)] = Number(p.valor_bomba ?? 0);
          }
          setNegociacoesPorEmpresa((prev) => {
            const cur = prev[codEmpresa] ?? { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} };
            return { ...prev, [codEmpresa]: { ...cur, precosBomba: map } };
          });
        })
        .catch(() => {});
    });
  }, [newTicketClientId, empresasSeparadas.join(",")]);

  const adicionarEmpresaSeparada = (codEmpresa: number) => {
    if (empresasSeparadas.includes(codEmpresa)) return;
    setEmpresasSeparadas((e) => [...e, codEmpresa]);
    setNegociacoesPorEmpresa((prev) => ({ ...prev, [codEmpresa]: { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} } }));
  };
  const removerEmpresaSeparada = (codEmpresa: number) => {
    setEmpresasSeparadas((e) => e.filter((x) => x !== codEmpresa));
    setNegociacoesPorEmpresa((prev) => { const next = { ...prev }; delete next[codEmpresa]; return next; });
  };
  const validarPrecoBombaMesmaNegociacao = async (): Promise<boolean> => {
    if (empresasMesmaNegociacao.length < 2 || combustiveisMesma.length === 0) return true;
    const resultados: Record<number, { nom_fantasia: string; precos: Record<number, number> }> = {};
    await Promise.all(
      empresasMesmaNegociacao.map(async (codEmpresa) => {
        const res = await fetch(`/api/tools/negociacoes/preco-bomba?clientId=${newTicketClientId}&codEmpresa=${codEmpresa}`);
        const data = await res.json();
        const nom = empresasOptions.find((e) => e.cod_empresa === codEmpresa)?.nom_fantasia ?? String(codEmpresa);
        const precos: Record<number, number> = {};
        if (Array.isArray(data)) for (const p of data) precos[Number(p.cod_item)] = Number(p.valor_bomba ?? 0);
        resultados[codEmpresa] = { nom_fantasia: nom, precos };
      })
    );
    const erros: { des_item: string; valores: { nom_fantasia: string; valor: number }[] }[] = [];
    for (const codItem of combustiveisMesma) {
      const desItem = combustiveisOptions.find((c) => c.cod_item === codItem)?.des_item ?? String(codItem);
      const valoresPorEmpresa = empresasMesmaNegociacao.map((codEmpresa) => ({ nom_fantasia: resultados[codEmpresa]?.nom_fantasia ?? String(codEmpresa), valor: resultados[codEmpresa]?.precos[codItem] ?? 0 }));
      const unicos = new Set(valoresPorEmpresa.map((v) => v.valor));
      if (unicos.size > 1) erros.push({ des_item: desItem, valores: valoresPorEmpresa });
    }
    if (erros.length > 0) { setErroPrecoBombaDiferente(erros); return false; }
    const primeiro = resultados[empresasMesmaNegociacao[0]];
    if (primeiro?.precos) setPrecosBombaMesma(primeiro.precos);
    setErroPrecoBombaDiferente(null);
    return true;
  };
  const carregarPrecosBombaMesma = async () => {
    if (empresasMesmaNegociacao.length === 0 || combustiveisMesma.length === 0) return;
    await validarPrecoBombaMesmaNegociacao();
  };

  const handleCreateTicket = async () => {
    if (!newTicketClientId || !newTicketContent.trim()) {
      toast.error("Preencha a mensagem.");
      return;
    }
    if (!isTipoCadastroDesconto && !assigneeId) {
      toast.error("Selecione o destinatário.");
      return;
    }
    if (isTipoCadastroDesconto) {
      if (clienteJaCadastrado !== "sim" && clienteJaCadastrado !== "nao") {
        toast.error("Informe se o cliente já tem cadastro (Sim ou Não).");
        return;
      }
      if (clienteJaCadastrado === "sim") {
        if (!cadastroEncontrado) {
          toast.error("Busque o cliente pelo código ou CNPJ/CPF antes de enviar.");
          return;
        }
      } else {
        if (!formDataCadastro.nome.trim()) {
          toast.error("Preencha o nome (razão social ou nome completo).");
          return;
        }
      }
      if (modoMultiEmpresa === "separadas") {
        if (empresasSeparadas.length === 0) {
          toast.error("Adicione ao menos uma empresa para negociação.");
          return;
        }
        const temDados = empresasSeparadas.some((codEmpresa) => {
          const neg = negociacoesPorEmpresa[codEmpresa];
          if (!neg) return false;
          return neg.combustiveisSelecionados.some((codItem) => (neg.tiposPorProduto[codItem] ?? []).length > 0);
        });
        if (!temDados) {
          toast.error("Preencha ao menos um produto e tipo de forma de pagamento em uma empresa.");
          return;
        }
      } else {
        if (empresasMesmaNegociacao.length === 0) {
          toast.error("Marque ao menos uma empresa para mesma negociação.");
          return;
        }
        if (empresasMesmaNegociacao.length >= 2 && combustiveisMesma.length > 0) {
          const ok = await validarPrecoBombaMesmaNegociacao();
          if (!ok) {
            toast.error("Preço de bomba diferente entre empresas. Veja o detalhe no popup.");
            return;
          }
        }
        if (combustiveisMesma.length === 0 || Object.keys(tiposPorProdutoMesma).every((k) => (tiposPorProdutoMesma[Number(k)] ?? []).length === 0)) {
          toast.error("Selecione produtos e tipos de forma de pagamento para a negociação.");
          return;
        }
      }
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        clientId: newTicketClientId,
        subject: subject.trim() || undefined,
        assigneeType,
        assigneeId,
        content: newTicketContent.trim(),
        tipoSolicitacaoId: tipoSolicitacaoId || undefined,
        priority: newTicketPriority || undefined,
      };
      if (isTipoCadastroDesconto) {
        body.assigneeType = "sector";
        body.assigneeId = undefined;
        const nome = clienteJaCadastrado === "sim" && cadastroEncontrado ? cadastroEncontrado.nom_pessoa : formDataCadastro.nome.trim();
        const codigo = clienteJaCadastrado === "sim" && cadastroEncontrado ? String(cadastroEncontrado.cod_pessoa) : formDataCadastro.codigo.trim();
        const cpfCnpjVal = clienteJaCadastrado === "sim" && cadastroEncontrado ? cadastroEncontrado.num_cnpj_cpf : formDataCadastro.cpfCnpj.trim();
        const negociacoes: { codEmpresa?: number; codEmpresas?: number[]; descontoPorProdutoTipo: { cod_item: number; des_item: string; ind_tipo: string; nome_tipo: string; valor_bomba: number; desconto?: string; valor_final: number | null }[]; volumePorProduto?: { cod_item: number; volumeLitros: number }[] }[] = [];
        if (modoMultiEmpresa === "separadas") {
          for (const codEmpresa of empresasSeparadas) {
            const neg = negociacoesPorEmpresa[codEmpresa];
            if (!neg) continue;
            const list = neg.combustiveisSelecionados.flatMap((codItem) => {
              const desItem = combustiveisOptions.find((c) => c.cod_item === codItem)?.des_item ?? "";
              const valorBomba = neg.precosBomba[codItem] ?? 0;
              const tipos = neg.tiposPorProduto[codItem] ?? [];
              return tipos.map((indTipo) => {
                const nomeTipo = formasComTipo.find((f) => f.ind_tipo === indTipo)?.nome_tipo_forma_pagamento ?? indTipo;
                const key = `${codItem}-${indTipo}`;
                const descontoStr = neg.gridDescontos[key] ?? "";
                const descontoNum = descontoStr === "" ? NaN : parseFloat(descontoStr.replace(",", "."));
                const valorFinal = Number.isNaN(descontoNum) ? null : valorBomba - descontoNum;
                return { cod_item: codItem, des_item: desItem, ind_tipo: indTipo, nome_tipo: nomeTipo, valor_bomba: valorBomba, desconto: descontoStr || undefined, valor_final: valorFinal };
              });
            });
            const volumePorProduto = (neg.volumePorProduto && Object.keys(neg.volumePorProduto).length > 0)
              ? neg.combustiveisSelecionados
                  .filter((cod) => neg.volumePorProduto[cod] !== "" && neg.volumePorProduto[cod] != null)
                  .map((cod) => ({ cod_item: cod, volumeLitros: Number(neg.volumePorProduto[cod]) }))
                  .filter((v) => !Number.isNaN(v.volumeLitros) && v.volumeLitros > 0)
                : undefined;
            if (list.length > 0) negociacoes.push({ codEmpresa, descontoPorProdutoTipo: list, volumePorProduto: volumePorProduto?.length ? volumePorProduto : undefined });
          }
        } else if (modoMultiEmpresa === "mesma" && empresasMesmaNegociacao.length > 0 && combustiveisMesma.length > 0) {
          if (erroPrecoBombaDiferente) {
            toast.error("Valores de bomba diferentes entre empresas. Corrija ou use negociação separada.");
            setCreating(false);
            return;
          }
          const list = combustiveisMesma.flatMap((codItem) => {
            const desItem = combustiveisOptions.find((c) => c.cod_item === codItem)?.des_item ?? "";
            const valorBomba = precosBombaMesma[codItem] ?? 0;
            const tipos = tiposPorProdutoMesma[codItem] ?? [];
            return tipos.map((indTipo) => {
              const nomeTipo = formasComTipo.find((f) => f.ind_tipo === indTipo)?.nome_tipo_forma_pagamento ?? indTipo;
              const key = `${codItem}-${indTipo}`;
              const descontoStr = gridDescontosMesma[key] ?? "";
              const descontoNum = descontoStr === "" ? NaN : parseFloat(descontoStr.replace(",", "."));
              const valorFinal = Number.isNaN(descontoNum) ? null : valorBomba - descontoNum;
              return { cod_item: codItem, des_item: desItem, ind_tipo: indTipo, nome_tipo: nomeTipo, valor_bomba: valorBomba, desconto: descontoStr || undefined, valor_final: valorFinal };
            });
          });
          const volumePorProdutoMesmaArr = combustiveisMesma
            .filter((cod) => volumePorProdutoMesma[cod] !== "" && volumePorProdutoMesma[cod] != null)
            .map((cod) => ({ cod_item: cod, volumeLitros: Number(volumePorProdutoMesma[cod]) }))
            .filter((v) => !Number.isNaN(v.volumeLitros) && v.volumeLitros > 0);
          if (list.length > 0) negociacoes.push({ codEmpresas: [...empresasMesmaNegociacao], descontoPorProdutoTipo: list, volumePorProduto: volumePorProdutoMesmaArr.length ? volumePorProdutoMesmaArr : undefined });
        }
        const totalVolume = negociacoes.reduce((acc, neg) => {
          const arr = neg.volumePorProduto ?? [];
          return acc + arr.reduce((s, v) => s + v.volumeLitros, 0);
        }, 0);
        const firstNeg = negociacoes[0];
        const firstTipoForma = firstNeg?.descontoPorProdutoTipo.length ? formasComTipo.find((f) => f.ind_tipo === (firstNeg.descontoPorProdutoTipo[0]?.ind_tipo ?? "")) : null;
        const formaCod = formDataCadastro.formaPagamentoCod ?? firstTipoForma?.cod_forma_pagto;
        const formaNome = formDataCadastro.formaPagamentoNome?.trim() || firstTipoForma?.nome_forma_pagamento || firstTipoForma?.nome_tipo_forma_pagamento;
        body.formData = {
          nome,
          codigo: codigo || undefined,
          cep: formDataCadastro.cep.trim() || undefined,
          endereco: formDataCadastro.endereco.trim() || undefined,
          contato: formDataCadastro.contato?.trim() || undefined,
          telefone: formDataCadastro.telefone.trim() || undefined,
          email: formDataCadastro.email?.trim() || undefined,
          cpfCnpj: cpfCnpjVal || undefined,
          inscricaoEstadual: formDataCadastro.inscricaoEstadual.trim() || undefined,
          observacoes: formDataCadastro.observacoes.trim() || undefined,
          formaPagamentoCod: formaCod ?? undefined,
          formaPagamentoNome: formaNome || undefined,
          volumeEstimadoLitros: totalVolume > 0 ? totalVolume : undefined,
          classeABC: formDataCadastro.classeABC?.trim() || undefined,
          ...(clienteJaCadastrado === "sim" && cadastroEncontrado ? { cadastroCodPessoa: cadastroEncontrado.cod_pessoa } : {}),
          ...(negociacoes.length > 0 ? { negociacoes } : {}),
        };
        const primeiroDesconto = negociacoes[0]?.descontoPorProdutoTipo?.find((r) => r.desconto != null && r.desconto !== "");
        body.custoOrcamento = primeiroDesconto != null && primeiroDesconto.desconto != null
          ? parseFloat(primeiroDesconto.desconto.replace(",", "."))
          : undefined;
        if (body.custoOrcamento != null && Number.isNaN(body.custoOrcamento)) body.custoOrcamento = undefined;
      }
      const res = await fetch("/api/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const ticketId = data.id as string;
        const firstMessage = Array.isArray(data.messages) ? data.messages[0] : null;
        const messageId = firstMessage?.id as string | undefined;
        if (messageId && newTicketFiles.length > 0) {
          for (const file of newTicketFiles) {
            const formData = new FormData();
            formData.append("ticketId", ticketId);
            formData.append("messageId", messageId);
            formData.append("file", file);
            const upRes = await fetch("/api/helpdesk/upload", { method: "POST", body: formData });
            if (!upRes.ok) {
              const err = await upRes.json().catch(() => ({}));
              toast.error(err.error ?? `Falha ao anexar ${file.name}`);
            }
          }
        }
        toast.success("Chamado criado.");
        setShowNewTicket(false);
        setSubject("");
        setNewTicketContent("");
        setAssigneeId("");
        setTipoSolicitacaoId("");
        setNewTicketPriority("");
        setNewTicketFiles([]);
        setFormDataCadastro({
          nome: "", codigo: "", cep: "", endereco: "", contato: "", telefone: "", email: "", cpfCnpj: "", inscricaoEstadual: "", observacoes: "",
          formaPagamentoCod: undefined, formaPagamentoNome: "", volumeEstimadoLitros: "", classeABC: "",
        });
        setClienteJaCadastrado("");
        setCadastroEncontrado(null);
        setBuscaCadastro("");
        setEmpresasSeparadas([]);
        setEmpresasMesmaNegociacao([]);
        setNegociacoesPorEmpresa({});
        setCombustiveisMesma([]);
        setTiposPorProdutoMesma({});
        setGridDescontosMesma({});
        setVolumePorProdutoMesma({});
        setPrecosBombaMesma({});
        setErroPrecoBombaDiferente(null);
        fetchTickets();
        fetchSummary();
      } else {
        toast.error(data.error ?? "Erro ao criar chamado");
      }
    } catch {
      toast.error("Erro ao criar chamado");
    } finally {
      setCreating(false);
    }
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ view: "meus_chamados" });
      if (clientId) q.set("clientId", clientId);
      const res = await fetch(`/api/helpdesk/tickets?${q}`);
      const data = await res.json();
      if (res.ok) setTickets(Array.isArray(data) ? data : []);
      else setTickets([]);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const fetchSummary = useCallback(async () => {
    const q = new URLSearchParams({ view: "meus_chamados" });
    if (clientId) q.set("clientId", clientId);
    const res = await fetch(`/api/helpdesk/tickets/summary?${q}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
    else setSummary(null);
  }, [clientId]);

  const fetchTicket = useCallback(async (id: string) => {
    const res = await fetch(`/api/helpdesk/tickets/${id}`);
    const data = await res.json();
    if (res.ok) {
      setReplyFiles([]);
      setSelectedTicket({
        id: data.id,
        messages: data.messages ?? [],
        subject: data.subject,
        status: data.status,
        creator: { id: data.creator?.id ?? "" },
        clientId: data.client?.id,
        client: data.client ? { id: data.client.id, name: data.client.name } : undefined,
        nivelCurvaAbc: data.nivelCurvaAbc ?? null,
      });
      await fetch("/api/helpdesk/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id }),
      });
    } else toast.error(data.error ?? "Erro ao carregar");
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    setClientId(clientes[0]?.id ?? "");
  }, [clientes]);

  useEffect(() => {
    if (showNewTicket) setNewTicketClientId((clientId || clientes[0]?.id) ?? "");
  }, [showNewTicket, clientId, clientes]);

  const handleReply = async () => {
    if (!selectedTicket || !replyContent.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        const messageId = data.id;
        if (messageId && replyFiles.length > 0) {
          for (const file of replyFiles) {
            const formData = new FormData();
            formData.set("ticketId", selectedTicket.id);
            formData.set("messageId", messageId);
            formData.set("file", file);
            await fetch("/api/helpdesk/upload", { method: "POST", body: formData });
          }
          setReplyFiles([]);
        }
        setReplyContent("");
        fetchTicket(selectedTicket.id);
        fetchTickets();
        fetchSummary();
      } else toast.error(data.error ?? "Erro ao enviar");
    } catch {
      toast.error("Erro ao enviar");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizar = async () => {
    if (!selectedTicket) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "concluido" }),
      });
      if (res.ok) {
        fetchTicket(selectedTicket.id);
        fetchTickets();
        fetchSummary();
        setSelectedTicket(null);
        toast.success("Chamado encerrado.");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao finalizar");
      }
    } catch {
      toast.error("Erro ao finalizar");
    } finally {
      setLoading(false);
    }
  };

  const isOpenStatus = (s: string) =>
    ["open", "in_progress", "pending_approval", "aguardando_atendimento", "em_atendimento", "aguardando_feedback_usuario", "agendado_com_usuario", "encaminhado_operador", "reaberto"].includes(s);
  const filtered = tickets.filter((t) =>
    tabFilter === "abertos" ? isOpenStatus(t.status) : ["closed", "concluido", "cancelled"].includes(t.status)
  );

  const areaLabel = (t: Ticket) =>
    t.group?.name ?? t.sector?.name ?? t.assigneeUser?.primaryGroup?.name ?? t.assigneeUser?.primarySector?.group?.name ?? "—";
  const departamentoLabel = (t: Ticket) =>
    t.sector?.name ?? t.group?.name ?? t.assigneeUser?.primarySector?.name ?? t.assigneeUser?.primaryGroup?.name ?? "—";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Meus Chamados</h1>
        <Button className="gap-2" onClick={() => setShowNewTicket(true)}>
          <IconPlus size={18} />
          Novo chamado
        </Button>
      </header>

      <Modal
        isOpen={showNewTicket}
        onClose={() => setShowNewTicket(false)}
        title="Novo Chamado"
        maxWidth="lg"
      >
        <div className="space-y-4">
          {clientes.length > 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Cliente</label>
              <select
                value={newTicketClientId}
                onChange={(e) => {
                  setNewTicketClientId(e.target.value);
                  setAssigneeId("");
                }}
                className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {!isTipoCadastroDesconto && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Departamento / Destinatário</label>
              <div className="flex gap-2">
                <select
                  value={assigneeType}
                  onChange={(e) => {
                    setAssigneeType(e.target.value as "user" | "group" | "sector");
                    setAssigneeId("");
                  }}
                  className="w-32 rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="user">Usuário</option>
                  <option value="group">Grupo</option>
                  <option value="sector">Setor</option>
                </select>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Selecione o destinatário...</option>
                  {assigneeOptions
                    .filter((o) => o.type === assigneeType)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                </select>
              </div>
            </div>
          )}
          {isTipoCadastroDesconto && (
            <p className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-sm text-zinc-400">
              Este chamado será enviado para <strong className="text-zinc-300">Análise de Crédito</strong>.
            </p>
          )}
          {tiposSolicitacaoFiltered.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-400">Tipo de Solicitação</label>
              <select
                value={tipoSolicitacaoId}
                onChange={(e) => {
                  setTipoSolicitacaoId(e.target.value);
                  if (tiposSolicitacaoFiltered.find((t) => t.id === e.target.value)?.nome !== TIPO_CADASTRO_DESCONTO_COMERCIAL) {
                    setFormDataCadastro({
                      nome: "", codigo: "", cep: "", endereco: "", contato: "", telefone: "", email: "", cpfCnpj: "", inscricaoEstadual: "", observacoes: "",
                      formaPagamentoCod: undefined, formaPagamentoNome: "", volumeEstimadoLitros: "", classeABC: "",
                    });
                    setClienteJaCadastrado("");
                    setCadastroEncontrado(null);
                    setBuscaCadastro("");
                    setEmpresasSeparadas([]);
                    setEmpresasMesmaNegociacao([]);
                    setNegociacoesPorEmpresa({});
                    setCombustiveisMesma([]);
                    setTiposPorProdutoMesma({});
                    setGridDescontosMesma({});
                    setErroPrecoBombaDiferente(null);
                  }
                }}
                className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Nenhum</option>
                {tiposSolicitacaoFiltered.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.parent_nome ? `${t.parent_nome} › ${t.nome}` : t.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {isTipoCadastroDesconto && (
            <div className="space-y-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-4">
              <h3 className="text-sm font-semibold text-zinc-300">Dados para cadastro e desconto comercial</h3>
              <div className="space-y-2">
                <span className="text-xs font-medium text-zinc-400">Cliente já tem cadastro?</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clienteJaCadastradoMc"
                      checked={clienteJaCadastrado === "sim"}
                      onChange={() => { setClienteJaCadastrado("sim"); setCadastroEncontrado(null); setBuscaCadastro(""); }}
                      className="rounded border-zinc-500 text-amber-500"
                    />
                    <span className="text-sm text-zinc-300">Sim</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="clienteJaCadastradoMc"
                      checked={clienteJaCadastrado === "nao"}
                      onChange={() => { setClienteJaCadastrado("nao"); setCadastroEncontrado(null); setBuscaCadastro(""); }}
                      className="rounded border-zinc-500 text-amber-500"
                    />
                    <span className="text-sm text-zinc-300">Não</span>
                  </label>
                </div>
              </div>
              {clienteJaCadastrado === "sim" && (
                <div className="space-y-2 rounded-lg border border-zinc-600/50 bg-zinc-800/50 p-3">
                  <label htmlFor="busca-cadastro-mc" className="block text-xs font-medium text-zinc-400">Buscar por código ou CNPJ/CPF</label>
                  <div className="flex gap-2">
                    <input
                      id="busca-cadastro-mc"
                      type="text"
                      value={buscaCadastro}
                      onChange={(e) => setBuscaCadastro(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), document.getElementById("btn-busca-cadastro-mc")?.click())}
                      placeholder="Código do cadastro ou CPF/CNPJ (11 ou 14 dígitos)"
                      className="flex-1 rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    />
                    <Button
                      id="btn-busca-cadastro-mc"
                      type="button"
                      disabled={!buscaCadastro.trim() || loadingBuscaCadastro}
                      onClick={async () => {
                        if (!newTicketClientId || !buscaCadastro.trim()) return;
                        setLoadingBuscaCadastro(true);
                        setCadastroEncontrado(null);
                        try {
                          const res = await fetch(
                            `/api/tools/negociacoes/cadastro-buscar?clientId=${encodeURIComponent(newTicketClientId)}&busca=${encodeURIComponent(buscaCadastro.trim())}`
                          );
                          const data = await res.json();
                          if (res.ok && Array.isArray(data) && data.length > 0) {
                            setCadastroEncontrado(data[0]);
                            toast.success("Cliente encontrado");
                          } else {
                            toast.info(Array.isArray(data) && data.length === 0 ? "Nenhum cadastro encontrado" : (data?.error ?? "Erro ao buscar"));
                          }
                        } catch {
                          toast.error("Erro ao buscar cadastro");
                        } finally {
                          setLoadingBuscaCadastro(false);
                        }
                      }}
                      className="shrink-0"
                    >
                      {loadingBuscaCadastro ? "Buscando..." : "Buscar"}
                    </Button>
                  </div>
                  {cadastroEncontrado && (
                    <div className="mt-2 rounded-lg bg-zinc-700/30 p-2 text-sm text-zinc-300">
                      <strong>Encontrado:</strong> {cadastroEncontrado.nom_pessoa} — Cód. {cadastroEncontrado.cod_pessoa}
                      {cadastroEncontrado.num_cnpj_cpf && ` — ${cadastroEncontrado.num_cnpj_cpf}`}
                    </div>
                  )}
                </div>
              )}
              {clienteJaCadastrado === "nao" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="cadastro-nome" className="mb-1 block text-xs font-medium text-zinc-400">Nome (razão social ou nome completo) *</label>
                  <input
                    id="cadastro-nome"
                    value={formDataCadastro.nome}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, nome: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-cep" className="mb-1 block text-xs font-medium text-zinc-400">CEP</label>
                  <input
                    id="cadastro-cep"
                    value={formDataCadastro.cep}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, cep: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="CEP"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-contato" className="mb-1 block text-xs font-medium text-zinc-400">Contato</label>
                  <input
                    id="cadastro-contato"
                    value={formDataCadastro.contato ?? ""}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, contato: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Nome do contato"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-telefone" className="mb-1 block text-xs font-medium text-zinc-400">Telefone</label>
                  <input
                    id="cadastro-telefone"
                    value={formDataCadastro.telefone}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, telefone: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Telefone"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-email" className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
                  <input
                    id="cadastro-email"
                    type="email"
                    value={formDataCadastro.email ?? ""}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cadastro-endereco" className="mb-1 block text-xs font-medium text-zinc-400">Endereço</label>
                  <input
                    id="cadastro-endereco"
                    value={formDataCadastro.endereco}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, endereco: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Endereço"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-cpfcnpj" className="mb-1 block text-xs font-medium text-zinc-400">CPF ou CNPJ</label>
                  <input
                    id="cadastro-cpfcnpj"
                    value={formDataCadastro.cpfCnpj}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, cpfCnpj: e.target.value }))}
                    onBlur={async () => {
                      const v = formDataCadastro.cpfCnpj.trim().replace(/\D/g, "");
                      if (v.length !== 11 && v.length !== 14) return;
                      if (!newTicketClientId) return;
                      try {
                        const res = await fetch(
                          `/api/tools/negociacoes/cadastro-buscar?clientId=${encodeURIComponent(newTicketClientId)}&busca=${encodeURIComponent(v)}`
                        );
                        const data = await res.json();
                        if (res.ok && Array.isArray(data) && data.length > 0) {
                          toast.info("Já existe cadastro com este CPF/CNPJ. Preenchendo nome e código.");
                          setFormDataCadastro((f) => ({
                            ...f,
                            nome: data[0].nom_pessoa,
                            codigo: String(data[0].cod_pessoa),
                            cpfCnpj: data[0].num_cnpj_cpf || f.cpfCnpj,
                          }));
                        }
                      } catch {
                        // ignore
                      }
                    }}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="CPF ou CNPJ"
                  />
                </div>
                <div>
                  <label htmlFor="cadastro-ie" className="mb-1 block text-xs font-medium text-zinc-400">Inscrição estadual (ou ORG)</label>
                  <input
                    id="cadastro-ie"
                    value={formDataCadastro.inscricaoEstadual}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, inscricaoEstadual: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="IE ou ORG"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cadastro-observacoes" className="mb-1 block text-xs font-medium text-zinc-400">Observações</label>
                  <input
                    id="cadastro-observacoes"
                    value={formDataCadastro.observacoes}
                    onChange={(e) => setFormDataCadastro((f) => ({ ...f, observacoes: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    placeholder="Observações gerais"
                  />
                </div>
                </div>
              )}
              {((clienteJaCadastrado === "sim" && cadastroEncontrado) || clienteJaCadastrado === "nao") && (
                <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-300">Empresas (postos)</h3>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="modo-empresa-mc" checked={modoMultiEmpresa === "separadas"} onChange={() => setModoMultiEmpresa("separadas")} className="rounded border-zinc-500 text-amber-500" />
                      <span className="text-sm text-zinc-300">Negociação separada (um box por empresa)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="modo-empresa-mc" checked={modoMultiEmpresa === "mesma"} onChange={() => setModoMultiEmpresa("mesma")} className="rounded border-zinc-500 text-amber-500" />
                      <span className="text-sm text-zinc-300">Mesma negociação (várias empresas)</span>
                    </label>
                  </div>
                  {modoMultiEmpresa === "separadas" && (
                    <div className="space-y-2">
                      <MultiSelect
                        label="Empresas (uma ou mais para negociação separada)"
                        options={empresasOptions.map((e) => ({ value: e.cod_empresa, label: e.nom_fantasia }))}
                        selected={empresasSeparadas}
                        onChange={(newSelected) => {
                          const next = newSelected as number[];
                          setEmpresasSeparadas(next);
                          setNegociacoesPorEmpresa((prev) => {
                            const out = { ...prev };
                            for (const cod of Object.keys(out).map(Number)) {
                              if (!next.includes(cod)) delete out[cod];
                            }
                            for (const cod of next) {
                              if (!out[cod]) out[cod] = { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} };
                            }
                            return out;
                          });
                        }}
                        placeholder="Selecione uma ou mais empresas..."
                        maxHeight="max-h-48"
                      />
                    </div>
                  )}
                  {modoMultiEmpresa === "mesma" && (
                    <div className="space-y-2">
                      <MultiSelect
                        label="Empresas para mesma negociação (preço de bomba deve ser igual)"
                        options={empresasOptions.map((e) => ({ value: e.cod_empresa, label: e.nom_fantasia }))}
                        selected={empresasMesmaNegociacao}
                        onChange={(v) => setEmpresasMesmaNegociacao(v as number[])}
                        placeholder="Selecione uma ou mais empresas..."
                        maxHeight="max-h-48"
                      />
                      {empresasMesmaNegociacao.length >= 2 && combustiveisMesma.length > 0 && (
                        <button type="button" onClick={carregarPrecosBombaMesma} className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200">Validar preço de bomba</button>
                      )}
                    </div>
                  )}
                  {modoMultiEmpresa === "separadas" && empresasSeparadas.map((codEmpresa) => {
                    const emp = empresasOptions.find((e) => e.cod_empresa === codEmpresa);
                    const neg = negociacoesPorEmpresa[codEmpresa];
                    if (!neg) return null;
                    return (
                      <div key={codEmpresa} className="rounded-lg border-2 border-zinc-600 bg-zinc-800/50 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-zinc-300">Negociação para {emp?.nom_fantasia ?? codEmpresa}</h4>
                          <button type="button" onClick={() => removerEmpresaSeparada(codEmpresa)} className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Remover empresa"><IconTrash size={18} strokeWidth={2} /></button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                              <MultiSelect
                                label="Produtos (combustíveis)"
                                options={combustiveisOptions.map((c) => ({ value: c.cod_item, label: c.des_item }))}
                                selected={neg.combustiveisSelecionados}
                                onChange={(arr) => setNegociacoesPorEmpresa((p) => {
                                  const n = p[codEmpresa] ?? { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} };
                                  return { ...p, [codEmpresa]: { ...n, combustiveisSelecionados: arr as number[] } };
                                })}
                                placeholder="Selecione um ou mais produtos..."
                                maxHeight="max-h-48"
                              />
                            </div>
                            {neg.combustiveisSelecionados.length > 0 && (
                              <button type="button" onClick={() => setNegociacoesPorEmpresa((p) => ({ ...p, [codEmpresa]: { ...neg, combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, volumePorProduto: {} } }))} className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir produtos"><IconTrash size={18} strokeWidth={2} /></button>
                            )}
                          </div>
                        </div>
                        {neg.combustiveisSelecionados.map((codItem) => {
                          const desItem = combustiveisOptions.find((c) => c.cod_item === codItem)?.des_item ?? "";
                          const tipos = neg.tiposPorProduto[codItem] ?? [];
                          const valorBomba = neg.precosBomba[codItem] ?? 0;
                          const tiposOptions = Array.from(new Map(formasComTipo.map((f) => [f.ind_tipo, f.nome_tipo_forma_pagamento])).entries()).map(([ind, nome]) => ({ value: ind, label: nome }));
                          return (
                            <div key={codItem} className="rounded border border-zinc-600/50 bg-zinc-800/30 p-3 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <p className="text-sm font-medium text-zinc-300">{desItem}</p>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-zinc-400">Volume (L)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={neg.volumePorProduto[codItem] ?? ""}
                                    onChange={(e) => setNegociacoesPorEmpresa((p) => { const n = p[codEmpresa] ?? { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} }; return { ...p, [codEmpresa]: { ...n, volumePorProduto: { ...n.volumePorProduto, [codItem]: e.target.value } } }; })}
                                    placeholder="Ex.: 500"
                                    className="w-24 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
                                  />
                                </div>
                              </div>
                              <div className="flex items-end gap-2">
                                <div className="flex-1 min-w-0 space-y-1">
                                  <MultiSelect
                                    label="Tipo de forma de pagamento"
                                    options={tiposOptions}
                                    selected={tipos}
                                    onChange={(next) => setNegociacoesPorEmpresa((p) => {
                                      const n = p[codEmpresa] ?? { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} };
                                      return { ...p, [codEmpresa]: { ...n, tiposPorProduto: { ...n.tiposPorProduto, [codItem]: next as string[] } } };
                                    })}
                                    placeholder="Selecione um ou mais tipos..."
                                    maxHeight="max-h-48"
                                  />
                                </div>
                                {tipos.length > 0 && (
                                  <button type="button" onClick={() => setNegociacoesPorEmpresa((p) => { const n = p[codEmpresa] ?? { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} }; const nextTipos = { ...n.tiposPorProduto, [codItem]: [] }; const keysToRemove = tipos.map((t) => `${codItem}-${t}`); const nextGrid = { ...n.gridDescontos }; keysToRemove.forEach((k) => delete nextGrid[k]); const nextVol = { ...n.volumePorProduto }; delete nextVol[codItem]; return { ...p, [codEmpresa]: { ...n, tiposPorProduto: nextTipos, gridDescontos: nextGrid, volumePorProduto: nextVol } }; })} className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir tipos deste produto"><IconTrash size={18} strokeWidth={2} /></button>
                                )}
                              </div>
                              {tipos.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm table-fixed">
                                    <thead><tr className="text-left text-zinc-400 border-b border-zinc-600"><th className="pb-1.5 pr-2">Tipo pagamento</th><th className="pb-1.5 pr-2 w-[100px]">Valor bomba</th><th className="pb-1.5 pr-2 w-[100px]">Negociação</th><th className="pb-1.5 w-[100px]">Valor combinado</th><th className="pb-1.5 w-10 text-center"></th></tr></thead>
                                    <tbody>
                                      {tipos.map((indTipo) => {
                                        const nomeTipo = formasComTipo.find((f) => f.ind_tipo === indTipo)?.nome_tipo_forma_pagamento ?? indTipo;
                                        const key = `${codItem}-${indTipo}`;
                                        const descontoStr = neg.gridDescontos[key] ?? "";
                                        const descontoNum = descontoStr === "" ? NaN : parseFloat(descontoStr.replace(",", "."));
                                        const valorCombinado = Number.isNaN(descontoNum) ? "" : (valorBomba - descontoNum).toFixed(2);
                                        return (
                                          <tr key={key} className="border-b border-zinc-700/50">
                                            <td className="py-1.5 pr-2 text-zinc-300 align-middle">{nomeTipo}</td>
                                            <td className="py-1.5 pr-2 text-zinc-300 align-middle">{valorBomba.toFixed(2)}</td>
                                            <td className="py-1.5 pr-2 align-middle">
                                              <input type="text" inputMode="decimal" value={neg.gridDescontos[key] ?? ""} onChange={(e) => setNegociacoesPorEmpresa((p) => { const n = p[codEmpresa] ?? { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} }; return { ...p, [codEmpresa]: { ...n, gridDescontos: { ...n.gridDescontos, [key]: e.target.value } } }; })} placeholder="0,00" className="w-full min-w-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-100 text-sm" />
                                            </td>
                                            <td className="py-1.5 text-zinc-300 align-middle">{valorCombinado}</td>
                                            <td className="py-1.5 align-middle w-10 text-center">
                                              <button type="button" onClick={() => setNegociacoesPorEmpresa((p) => { const n = p[codEmpresa] ?? { combustiveisSelecionados: [], tiposPorProduto: {}, gridDescontos: {}, precosBomba: {}, volumePorProduto: {} }; const nextTipos = (n.tiposPorProduto[codItem] ?? []).filter((t) => t !== indTipo); const nextTiposMap = { ...n.tiposPorProduto, [codItem]: nextTipos }; const nextGrid = { ...n.gridDescontos }; delete nextGrid[key]; return { ...p, [codEmpresa]: { ...n, tiposPorProduto: nextTiposMap, gridDescontos: nextGrid } }; })} className="inline-flex p-2 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10" title="Excluir este tipo"><IconTrash size={18} strokeWidth={2} /></button>
                                            </td>
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
                  {modoMultiEmpresa === "mesma" && empresasMesmaNegociacao.length > 0 && (
                    <div className="rounded-lg border-2 border-zinc-600 bg-zinc-800/50 p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-zinc-300">Mesma negociação</h4>
                      <div className="space-y-2">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 min-w-0">
                            <MultiSelect
                              label="Produtos (combustíveis)"
                              options={combustiveisOptions.map((c) => ({ value: c.cod_item, label: c.des_item }))}
                              selected={combustiveisMesma}
                              onChange={(v) => setCombustiveisMesma(v as number[])}
                              placeholder="Selecione um ou mais produtos..."
                              maxHeight="max-h-48"
                            />
                          </div>
                          {combustiveisMesma.length > 0 && (
                            <button type="button" onClick={() => { setCombustiveisMesma([]); setTiposPorProdutoMesma({}); setGridDescontosMesma({}); setVolumePorProdutoMesma({}); }} className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir produtos"><IconTrash size={18} strokeWidth={2} /></button>
                          )}
                        </div>
                      </div>
                      {combustiveisMesma.map((codItem) => {
                        const desItem = combustiveisOptions.find((c) => c.cod_item === codItem)?.des_item ?? "";
                        const tipos = tiposPorProdutoMesma[codItem] ?? [];
                        const valorBomba = precosBombaMesma[codItem] ?? 0;
                        const tiposOptions = Array.from(new Map(formasComTipo.map((f) => [f.ind_tipo, f.nome_tipo_forma_pagamento])).entries()).map(([ind, nome]) => ({ value: ind, label: nome }));
                        return (
                          <div key={codItem} className="rounded border border-zinc-600/50 bg-zinc-800/30 p-3 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <p className="text-sm font-medium text-zinc-300">{desItem}</p>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-zinc-400">Volume (L)</label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={volumePorProdutoMesma[codItem] ?? ""}
                                  onChange={(e) => setVolumePorProdutoMesma((v) => ({ ...v, [codItem]: e.target.value }))}
                                  placeholder="Ex.: 500"
                                  className="w-24 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
                                />
                              </div>
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1 min-w-0 space-y-1">
                                <MultiSelect
                                  label="Tipo de forma de pagamento"
                                  options={tiposOptions}
                                  selected={tipos}
                                  onChange={(next) => setTiposPorProdutoMesma((t) => ({ ...t, [codItem]: next as string[] }))}
                                  placeholder="Selecione um ou mais tipos..."
                                  maxHeight="max-h-48"
                                />
                              </div>
                              {tipos.length > 0 && (
                                <button type="button" onClick={() => { setTiposPorProdutoMesma((t) => ({ ...t, [codItem]: [] })); setGridDescontosMesma((g) => { const next = { ...g }; tipos.forEach((t) => delete next[`${codItem}-${t}`]); return next; }); }} className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800" title="Excluir tipos deste produto"><IconTrash size={18} strokeWidth={2} /></button>
                              )}
                            </div>
                            {tipos.length > 0 && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm table-fixed">
                                  <thead><tr className="text-left text-zinc-400 border-b border-zinc-600"><th className="pb-1.5 pr-2">Tipo pagamento</th><th className="pb-1.5 pr-2 w-[100px]">Valor bomba</th><th className="pb-1.5 pr-2 w-[100px]">Negociação</th><th className="pb-1.5 w-[100px]">Valor combinado</th><th className="pb-1.5 w-10 text-center"></th></tr></thead>
                                  <tbody>
                                    {tipos.map((indTipo) => {
                                      const nomeTipo = formasComTipo.find((f) => f.ind_tipo === indTipo)?.nome_tipo_forma_pagamento ?? indTipo;
                                      const key = `${codItem}-${indTipo}`;
                                      const descontoStr = gridDescontosMesma[key] ?? "";
                                      const descontoNum = descontoStr === "" ? NaN : parseFloat(descontoStr.replace(",", "."));
                                      const valorCombinado = Number.isNaN(descontoNum) ? "" : (valorBomba - descontoNum).toFixed(2);
                                      return (
                                        <tr key={key} className="border-b border-zinc-700/50">
                                          <td className="py-1.5 pr-2 text-zinc-300 align-middle">{nomeTipo}</td>
                                          <td className="py-1.5 pr-2 text-zinc-300 align-middle">{valorBomba.toFixed(2)}</td>
                                          <td className="py-1.5 pr-2 align-middle">
                                            <input type="text" inputMode="decimal" value={gridDescontosMesma[key] ?? ""} onChange={(e) => setGridDescontosMesma((g) => ({ ...g, [key]: e.target.value }))} placeholder="0,00" className="w-full min-w-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-100 text-sm" />
                                          </td>
                                          <td className="py-1.5 text-zinc-300 align-middle">{valorCombinado}</td>
                                          <td className="py-1.5 align-middle w-10 text-center">
                                            <button type="button" onClick={() => { setTiposPorProdutoMesma((t) => ({ ...t, [codItem]: (t[codItem] ?? []).filter((x) => x !== indTipo) })); setGridDescontosMesma((g) => { const next = { ...g }; delete next[key]; return next; }); }} className="inline-flex p-2 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10" title="Excluir este tipo"><IconTrash size={18} strokeWidth={2} /></button>
                                          </td>
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
                  )}
                  {erroPrecoBombaDiferente != null && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setErroPrecoBombaDiferente(null)}>
                      <div className="rounded-lg border border-red-500/50 bg-zinc-800 p-4 max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h4 className="text-sm font-semibold text-red-300 mb-2">Preço de bomba diferente</h4>
                        <p className="text-sm text-zinc-300 mb-3">Os valores não são iguais em todas as empresas. Não é possível usar a mesma negociação.</p>
                        <ul className="text-sm text-zinc-400 space-y-1 mb-4">
                          {erroPrecoBombaDiferente.map((item, i) => (
                            <li key={i}><strong className="text-zinc-200">{item.des_item}</strong> — {item.valores.map((v) => `${v.nom_fantasia}: R$ ${v.valor.toFixed(2)}`).join("; ")}</li>
                          ))}
                        </ul>
                        <button type="button" onClick={() => setErroPrecoBombaDiferente(null)} className="rounded-lg bg-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-500">Fechar</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {clienteJaCadastrado === "sim" && cadastroEncontrado && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-400">Curva ABC (nível do cadastro)</label>
                      {loadingNivelCurvaAbc ? (
                        <p className="text-sm text-zinc-500">Carregando...</p>
                      ) : formDataCadastro.classeABC ? (
                        <span
                          className={
                            formDataCadastro.classeABC === "A"
                              ? "inline-flex rounded px-2 py-1 text-sm font-medium bg-emerald-500/20 text-emerald-400"
                              : formDataCadastro.classeABC === "B"
                                ? "inline-flex rounded px-2 py-1 text-sm font-medium bg-amber-500/20 text-amber-400"
                                : "inline-flex rounded px-2 py-1 text-sm font-medium bg-zinc-500/20 text-zinc-300"
                          }
                        >
                          {formDataCadastro.classeABC}
                        </span>
                      ) : (
                        <p className="text-sm text-zinc-500">—</p>
                      )}
                    </div>
                  )}
                </div>
              </>
              )}
            </div>
          )}
          <div>
            <label htmlFor="new-ticket-priority" className="mb-1.5 block text-sm font-medium text-zinc-400">Prioridade</label>
            <select
              id="new-ticket-priority"
              value={newTicketPriority}
              onChange={(e) => setNewTicketPriority(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
              aria-label="Prioridade do chamado"
            >
              <option value="">Nenhuma</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <label htmlFor="new-ticket-subject" className="mb-1.5 block text-sm font-medium text-zinc-400">Assunto</label>
            <input
              id="new-ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Assunto do chamado"
              aria-label="Assunto do chamado"
            />
          </div>
          <div>
            <label htmlFor="new-ticket-message" className="mb-1.5 block text-sm font-medium text-zinc-400">Mensagem</label>
            <textarea
              id="new-ticket-message"
              value={newTicketContent}
              onChange={(e) => setNewTicketContent(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Descreva aqui o seu chamado"
              aria-label="Mensagem do chamado"
            />
          </div>
          <div>
            <label htmlFor="new-ticket-attachments" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-400">
              <IconPaperclip size={16} />
              Anexar documentos
            </label>
            <input
              id="new-ticket-attachments"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="mt-1 block w-full text-sm text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-zinc-200 file:hover:bg-zinc-600"
              onChange={(e) => setNewTicketFiles(Array.from(e.target.files ?? []))}
              aria-label="Anexar documentos ao chamado"
            />
            {newTicketFiles.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                {newTicketFiles.map((f, i) => (
                  <li key={i} className="rounded bg-zinc-800/50 px-2 py-1">
                    {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
            <Button variant="secondary" onClick={() => { setShowNewTicket(false); setNewTicketFiles([]); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTicket} disabled={creating}>
              Criar Chamado
            </Button>
          </div>
        </div>
      </Modal>

      {summary && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
          <button
            type="button"
            onClick={() => setTabFilter("abertos")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
              {(summary.abertos ?? 0) + (summary.aguardandoAtendimento ?? 0) + (summary.agendado ?? 0)}
            </span>
            Abertos / Aguardando
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("abertos")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">{summary.emAtendimento ?? summary.emAndamento ?? 0}</span>
            Em atendimento
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("abertos")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">{summary.aguardandoFeedback ?? 0}</span>
            Aguardando feedback
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("encerrados")}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
          >
            <span className="rounded-full bg-zinc-600/50 px-2 py-0.5 text-xs text-zinc-400">{summary.concluido ?? summary.encerrados ?? 0}</span>
            Encerrados
          </button>
        </div>
      )}

      {clientes.length > 1 && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4 max-w-xs">
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-1 border-b border-zinc-700/50">
        <button
          type="button"
          onClick={() => setTabFilter("abertos")}
          className={`px-4 py-2 text-sm font-medium ${tabFilter === "abertos" ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Abertos
        </button>
        <button
          type="button"
          onClick={() => setTabFilter("encerrados")}
          className={`px-4 py-2 text-sm font-medium ${tabFilter === "encerrados" ? "text-zinc-100 border-b-2 border-zinc-100 -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Encerrados
        </button>
      </div>

      <div>
          {loading ? (
            <p className="text-zinc-500 text-sm py-4">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm py-4">Nenhum chamado nesta aba.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-700/50 bg-zinc-900/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700/50">
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Nº</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Área</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Depto</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-400">Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => fetchTicket(t.id)}
                      className={`border-b border-zinc-700/30 cursor-pointer transition-colors hover:bg-zinc-800/30 ${selectedTicket?.id === t.id ? "bg-zinc-800/50" : ""}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">#{t.numero ?? t.id.slice(-8)}</td>
                      <td className="px-3 py-2.5 text-zinc-300 max-w-[100px] truncate">{areaLabel(t)}</td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[100px] truncate">{t.tipoSolicitacao?.nome ?? "—"}</td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[100px] truncate">{t.client.name}</td>
                      <td className="px-3 py-2.5 text-zinc-400 max-w-[80px] truncate">{departamentoLabel(t)}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-zinc-700/50 text-zinc-300">
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500">{t.priority ? (PRIORITY_LABEL[t.priority] ?? t.priority) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {selectedTicket && (
        <Modal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={`Chamado #${tickets.find((t) => t.id === selectedTicket.id)?.numero ?? selectedTicket.id.slice(-8)}`}
          maxWidth="lg"
        >
          <div className="flex flex-col max-h-[70vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 border-b border-zinc-700/50">
              <p className="text-sm text-zinc-400">
                <span className="font-medium text-zinc-300">Cliente:</span> {selectedTicket.client?.name ?? "—"}
              </p>
              {selectedTicket.messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-400">{m.user.name}</span>
                    <span>{new Date(m.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">{m.content}</p>
                  {m.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {m.attachments.map((a) => (
                        <a key={a.id} href={a.storagePath} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                          {a.filename}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedTicket.clientId && (
                  <Button variant="secondary" onClick={() => setShowEncaminhar(true)}>
                    Agendar / Encaminhar
                  </Button>
                )}
                {!["closed", "concluido"].includes(selectedTicket.status) && (
                  <Button variant="secondary" onClick={handleFinalizar} disabled={loading} className="text-amber-400 hover:text-amber-300">
                    Finalizar chamado
                  </Button>
                )}
              </div>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Responder..."
                rows={3}
                className="w-full resize-none rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 mb-2"
              />
              <div className="mb-2">
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <IconPaperclip size={16} />
                  <span>Anexar arquivos à resposta</span>
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => setReplyFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                  />
                </label>
                {replyFiles.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {replyFiles.map((f, i) => (
                      <li key={i} className="rounded bg-zinc-800/50 px-2 py-1 flex items-center gap-1">
                        {f.name} ({(f.size / 1024).toFixed(1)} KB)
                        <button type="button" onClick={() => setReplyFiles((p) => p.filter((_, j) => j !== i))} className="text-red-400 hover:underline">remover</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setSelectedTicket(null)}>
                  Fechar
                </Button>
                <Button onClick={() => { handleReply(); }} disabled={loading || !replyContent.trim()} className="gap-2">
                  <IconSend size={16} />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showEncaminhar && selectedTicket?.clientId && (
        <EncaminharModal
          ticketId={selectedTicket.id}
          clientId={selectedTicket.clientId}
          onClose={() => setShowEncaminhar(false)}
          onSuccess={() => { fetchTicket(selectedTicket.id); fetchTickets(); fetchSummary(); }}
        />
      )}
    </div>
  );
}
