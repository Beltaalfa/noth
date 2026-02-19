import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { canUserAccessTicket } from "@/lib/helpdesk";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = /^(image|audio|video|application|text)\//;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const formData = await request.formData();
  const ticketId = formData.get("ticketId") as string | null;
  const messageId = formData.get("messageId") as string | null;
  const file = formData.get("file") as File | null;

  if (!ticketId || !messageId || !file) {
    return NextResponse.json({ error: "ticketId, messageId e file são obrigatórios" }, { status: 400 });
  }

  const canAccess = await canUserAccessTicket(userId, ticketId);
  if (!canAccess) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const msg = await prisma.helpdeskMessage.findFirst({
    where: { id: messageId, ticketId },
  });
  if (!msg) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 20MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.test(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "helpdesk", ticketId, messageId);
  await mkdir(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const storagePath = `/uploads/helpdesk/${ticketId}/${messageId}/${filename}`;

  const attachment = await prisma.helpdeskAttachment.create({
    data: {
      messageId,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      storagePath,
    },
  });

  return NextResponse.json(attachment);
}
