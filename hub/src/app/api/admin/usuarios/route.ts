import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  status: z.enum(["active", "inactive"]).default("active"),
  role: z.enum(["client", "admin"]).default("client"),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const limit = searchParams.get("limit");

  if (page && limit) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit)) || 25);
    const skip = (p - 1) * l;
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        skip,
        take: l,
        select: { id: true, name: true, email: true, status: true, role: true, createdAt: true },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);
    return NextResponse.json({ data, total });
  }

  const usuarios = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, status: true, role: true, createdAt: true },
  });
  return NextResponse.json(usuarios);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const exists = await prisma.user.findFirst({
    where: { email: parsed.data.email, deletedAt: null },
  });
  if (exists) {
    return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      status: parsed.data.status,
      role: parsed.data.role,
    },
    select: { id: true, name: true, email: true, status: true, role: true, createdAt: true },
  });
  return NextResponse.json(user);
}
