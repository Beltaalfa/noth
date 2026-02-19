import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL deve ser uma URL válida"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET é obrigatório (use openssl rand -base64 32)"),
  ENCRYPTION_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Variáveis de ambiente inválidas: ${msg}`);
  }
  return parsed.data;
}

export const env = validateEnv();
