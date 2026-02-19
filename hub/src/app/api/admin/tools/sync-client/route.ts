import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Garante que cada ferramenta tenha vínculo ClientTool com seu cliente (para aparecer no portal). */
export async function POST() {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const tools = await prisma.tool.findMany({
    select: { id: true, clientId: true },
  });
  let created = 0;
  for (const tool of tools) {
    await prisma.clientTool.upsert({
      where: {
        clientId_toolId: { clientId: tool.clientId, toolId: tool.id },
      },
      create: { clientId: tool.clientId, toolId: tool.id },
      update: {},
    });
    created += 1;
  }
  return NextResponse.json({ ok: true, synced: created });
}
