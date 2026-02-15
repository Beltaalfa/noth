import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  clientId: z.string().min(1).optional(),
  type: z.enum(["postgres", "firebird"]).optional(),
  host: z.string().min(1).optional(),
  port: z.number().min(1).max(65535).optional(),
  user: z.string().min(1).optional(),
  password: z.string().optional(),
  database: z.string().min(1).optional(),
  extraParams: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

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
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const data = { ...parsed.data };
  if (!data.password) delete (data as { password?: string }).password;

  const conexao = await prisma.dbConnection.update({
    where: { id },
    data,
    include: { client: { select: { name: true } } },
  });
  return NextResponse.json(conexao);
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
  await prisma.dbConnection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
