import { z } from "zod";

const assigneeTypeEnum = z.enum(["user", "group", "sector"]);
const priorityEnum = z.enum(["baixa", "media", "alta", "critica"]);

/** Nome do tipo de solicitação para "Cadastro e aprovação de desconto comercial" (identificação por nome). */
export const TIPO_CADASTRO_DESCONTO_COMERCIAL = "Cadastro e aprovação de desconto comercial";

/** Schema dos dados do formulário quando tipo = Cadastro e aprovação de desconto comercial */
export const formDataCadastroDescontoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
  cpfCnpj: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  observacoes: z.string().optional(),
});

export type FormDataCadastroDesconto = z.infer<typeof formDataCadastroDescontoSchema>;

export const createTicketBodySchema = z.object({
  clientId: z.string().min(1, "clientId é obrigatório"),
  subject: z.string().optional(),
  assigneeType: assigneeTypeEnum,
  assigneeId: z.string().min(1, "assigneeId é obrigatório"),
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
