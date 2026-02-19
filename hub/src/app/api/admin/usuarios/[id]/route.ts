import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  role: z.enum(["client", "admin"]).optional(),
  helpdeskNivelAcesso: z.enum(["solicitante", "operador", "gestor", "admin"]).nullable().optional(),
  primaryGroupId: z.string().nullable().optional(),
  primarySectorId: z.string().nullable().optional(),
  isGerenteArea: z.boolean().optional(),
  podeReceberChamados: z.boolean().optional(),
  podeEncaminharChamados: z.boolean().optional(),
  valorMaximoAutorizar: z.number().nullable().optional(),
  allowRelatorios: z.boolean().nullable().optional(),
  allowAjusteDespesa: z.boolean().nullable().optional(),
  allowNegociacoes: z.boolean().nullable().optional(),
  allowHelpdesk: z.boolean().nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, name: true, email: true, status: true, role: true,
      helpdeskNivelAcesso: true, primaryGroupId: true, primarySectorId: true,
      isGerenteArea: true, podeReceberChamados: true, podeEncaminharChamados: true, valorMaximoAutorizar: true,
      allowRelatorios: true, allowAjusteDespesa: true, allowNegociacoes: true, allowHelpdesk: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const out = { ...user, valorMaximoAutorizar: user.valorMaximoAutorizar != null ? Number(user.valorMaximoAutorizar) : null };
  return NextResponse.json(out);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    delete data.password;
  }
  if (parsed.data.valorMaximoAutorizar !== undefined) {
    data.valorMaximoAutorizar = parsed.data.valorMaximoAutorizar;
  }

  if (parsed.data.email) {
    const exists = await prisma.user.findFirst({
      where: {
        email: parsed.data.email,
        id: { not: id },
        deletedAt: null,
      },
    });
    if (exists) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, name: true, email: true, status: true, role: true,
      helpdeskNivelAcesso: true, primaryGroupId: true, primarySectorId: true,
      isGerenteArea: true, podeReceberChamados: true, podeEncaminharChamados: true, valorMaximoAutorizar: true,
      allowRelatorios: true, allowAjusteDespesa: true, allowNegociacoes: true, allowHelpdesk: true,
    },
  });
  const out = { ...user, valorMaximoAutorizar: user.valorMaximoAutorizar != null ? Number(user.valorMaximoAutorizar) : null };
  return NextResponse.json(out);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
