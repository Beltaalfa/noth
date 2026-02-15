import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getToolsForUser } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const tools = await getToolsForUser(userId);
  return NextResponse.json(tools);
}
