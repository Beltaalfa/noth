-- Add numero column for sequential ticket numbering per client
ALTER TABLE "HelpdeskTicket" ADD COLUMN IF NOT EXISTS "numero" INTEGER;
