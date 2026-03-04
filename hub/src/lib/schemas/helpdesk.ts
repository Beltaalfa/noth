import { z } from "zod";

const assigneeTypeEnum = z.enum(["user", "group", "sector"]);
const priorityEnum = z.enum(["baixa", "media", "alta", "critica"]);

/** Nome do tipo de solicitação para "Cadastro e aprovação de desconto comercial" (identificação por nome). */
export const TIPO_CADASTRO_DESCONTO_COMERCIAL = "Cadastro e aprovação de desconto comercial";

/** Schema dos dados do formulário quando tipo = Cadastro e aprovação de desconto comercial */
export const formDataCadastroDescontoSchema = z.object({
  nome: z.string().optional().default(""),
  codigo: z.string().optional(),
  /** Código do cadastro no sistema externo (tab_pessoa) quando cliente já tem cadastro. */
  cadastroCodPessoa: z.number().optional(),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  contato: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  cpfCnpj: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  observacoes: z.string().optional(),
  /** Código da forma de pagamento no sistema externo (tab_forma_pagto_pdv). POP alçada nível 1. */
  formaPagamentoCod: z.union([z.number(), z.string()]).optional().transform((v) => (v === "" || v == null ? undefined : Number(v))),
  /** Nome da forma de pagamento para exibição e validação à vista. */
  formaPagamentoNome: z.string().optional(),
  /** Volume estimado em litros (POP: 500L nível 1; 10k–15k nível 3; ≥15k nível 4). */
  volumeEstimadoLitros: z.union([z.number(), z.string()]).optional().transform((v) => (v === "" || v == null ? undefined : Number(v))),
  /** Classe ABC do cliente (POP nível 2: A ou B para aprovação em Gerência). */
  classeABC: z
    .union([z.enum(["A", "B", "C"]), z.string()])
    .optional()
    .transform((s) => (typeof s === "string" && /^[ABC]$/i.test(s.trim()) ? s.trim().toUpperCase() as "A" | "B" | "C" : undefined)),
  /** Código da empresa (posto) para grid de combustíveis (legado, uma empresa). */
  codEmpresa: z.number().optional(),
  /** Múltiplas negociações: uma por empresa (separadas) ou uma com várias empresas (mesma negociação). */
  negociacoes: z
    .array(
      z.object({
        codEmpresa: z.number().optional(),
        codEmpresas: z.array(z.number()).optional(),
        descontoPorProdutoTipo: z.array(
          z.object({
            cod_item: z.number(),
            des_item: z.string(),
            ind_tipo: z.string(),
            nome_tipo: z.string(),
            valor_bomba: z.number(),
            desconto: z.string().optional(),
            valor_final: z.number().nullable().optional(),
          })
        ),
        /** Volume estimado (L) por produto (cod_item). Um por combustível na negociação. */
        volumePorProduto: z
          .array(z.object({ cod_item: z.number(), volumeLitros: z.number() }))
          .optional(),
      })
    )
    .optional(),
  /** Grid desconto por produto e tipo de forma de pagamento (legado, quando uma empresa). */
  descontoPorProdutoTipo: z
    .array(
      z.object({
        cod_item: z.number(),
        des_item: z.string(),
        ind_tipo: z.string(),
        nome_tipo: z.string(),
        valor_bomba: z.number(),
        desconto: z.string().optional(),
        valor_final: z.number().nullable().optional(),
      })
    )
    .optional(),
});

export type FormDataCadastroDesconto = z.infer<typeof formDataCadastroDescontoSchema>;

export const createTicketBodySchema = z.object({
  clientId: z.string().min(1, "clientId é obrigatório"),
  subject: z.string().optional(),
  assigneeType: assigneeTypeEnum,
  /** Obrigatório exceto para tipo "Cadastro e aprovação de desconto comercial" (destino fixo Análise de Crédito). */
  assigneeId: z.string().optional().transform((v) => (v === "" || v == null ? undefined : v)),
  content: z.string().min(1, "content é obrigatório").transform((s) => s.trim()),
  tipoSolicitacaoId: z.string().optional(),
  priority: priorityEnum.optional().nullable(),
  /** Dados do formulário dinâmico (ex.: cadastro de cliente). Validado quando tipo = Cadastro e aprovação de desconto comercial. */
  formData: z.record(z.string(), z.unknown()).optional(),
  /** Valor do desconto em reais (ex.: 0.10, 0.20). Obrigatório quando tipo = Cadastro e aprovação de desconto comercial. */
  custoOrcamento: z.union([z.number(), z.string()]).optional().transform((v) => (v === "" || v == null ? undefined : Number(v))),
});

export const messageBodySchema = z.object({
  content: z.string().min(1, "content é obrigatório").transform((s) => s.trim()),
});

export const encaminharBodySchema = z.object({
  novoResponsavelUserId: z.string().min(1, "novoResponsavelUserId é obrigatório"),
  operadoresAuxiliaresIds: z.array(z.string()).optional().default([]),
  scheduledAt: z.string().optional().nullable(),
  comentario: z.string().optional().nullable(),
});

const validStatuses = [
  "open", "in_progress", "closed", "pending_approval", "in_approval", "rejected", "approved", "cancelled",
  "agendado_com_usuario", "aguardando_atendimento", "em_atendimento", "aguardando_feedback_usuario",
  "encaminhado_operador", "indisponivel_atendimento", "reaberto", "retornado_usuario",
  "custo_aguardando_aprovacao", "autorizado", "negado", "atualizado", "concluido",
  "aguardando_aprovacao_proprietarios",
] as const;

export const patchTicketBodySchema = z.object({
  status: z.enum(validStatuses).optional(),
  priority: priorityEnum.optional().nullable(),
  subject: z.string().optional().nullable(),
  content: z.string().optional(),
  assigneeUserId: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
});

export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;
export type MessageBody = z.infer<typeof messageBodySchema>;
export type EncaminharBody = z.infer<typeof encaminharBodySchema>;
export type PatchTicketBody = z.infer<typeof patchTicketBodySchema>;
