import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientIdsForCurvaABC } from "@/lib/permissions";
import { getNivelCurvaABCPorCodPessoa } from "@/lib/curva-abc";

/** GET ?clientId=...&cod_pessoa=... — Retorna o nível na Curva ABC (A, B ou C) para o cadastro. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") ?? searchParams.get("clienteId");
  const codPessoaParam = searchParams.get("cod_pessoa");
  if (!clientId || codPessoaParam == null || codPessoaParam === "") {
    return NextResponse.json({ error: "clientId e cod_pessoa são obrigatórios" }, { status: 400 });
  }
  const codPessoa = parseInt(codPessoaParam, 10);
  if (Number.isNaN(codPessoa)) {
    return NextResponse.json({ error: "cod_pessoa inválido" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const allowedClientIds = await getClientIdsForCurvaABC(userId, isAdmin);
  if (!allowedClientIds.includes(clientId)) {
    return NextResponse.json({ error: "Sem permissão para este cliente" }, { status: 403 });
  }

  const nivelCurvaAbc = await getNivelCurvaABCPorCodPessoa(clientId, codPessoa);
  return NextResponse.json({ nivelCurvaAbc });
}
