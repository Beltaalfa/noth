import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAlteracaoDespesaToolsForUser } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  const tools = await getAlteracaoDespesaToolsForUser(userId);
  const clientes = tools.map((t) => ({ id: t.clientId, name: t.client.name }));

  return NextResponse.json(clientes);
}
