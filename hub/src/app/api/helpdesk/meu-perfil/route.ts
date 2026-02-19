import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getHelpdeskProfile } from "@/lib/helpdesk";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const profile = await getHelpdeskProfile(userId);
  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  return NextResponse.json({
    ...profile,
    isAdmin: !!isAdmin,
    podeVerMeusChamados: true,
    podeVerFilas: !!profile?.podeReceberChamados,
    podeVerAreasGeridas: !!profile?.isGerenteArea,
    podeVerArvore: !!profile?.isGerenteArea,
  });
}
