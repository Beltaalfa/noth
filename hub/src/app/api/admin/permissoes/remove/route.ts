import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ action: z.string(), id: z.string() });

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await request.json();
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { action, id } = p.data;
  if (action === "userClient") await prisma.userClientPermission.delete({ where: { id } });
  else if (action === "userGroup") await prisma.userGroupPermission.delete({ where: { id } });
  else if (action === "userSector") await prisma.userSectorPermission.delete({ where: { id } });
  else if (action === "clientTool") await prisma.clientTool.delete({ where: { id } });
  else return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  return NextResponse.json({ ok: true });
}
