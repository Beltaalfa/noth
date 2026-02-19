import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { canUserAccessReport } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import Link from "next/link";
import { IconArrowLeft, IconMaximize } from "@tabler/icons-react";

export default async function RelatorioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");
  const isAdmin = (session.user as { role?: string })?.role === "admin";

  const { slug } = await params;
  const tool = await prisma.tool.findFirst({
    where: { slug, type: "powerbi_report", status: "active" },
    include: { client: { select: { name: true, logoUrl: true } } },
  });

  if (!tool || !tool.powerbiUrl) notFound();

  const canAccess = await canUserAccessReport(userId, tool.id, isAdmin);
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <h1 className="text-2xl font-bold text-zinc-100">Sem permissão</h1>
        <p className="text-zinc-500 mt-2">Você não tem acesso a este relatório.</p>
        <Link href="/relatorios" className="mt-4 text-blue-400 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  await logAudit({
    userId,
    action: "report_view",
    entity: "Tool",
    entityId: tool.id,
    details: JSON.stringify({ name: tool.name, slug: tool.slug }),
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <header className="flex items-center gap-4 h-12 px-4 shrink-0 border-b border-zinc-800 bg-zinc-900/50">
        <Link href="/relatorios" className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
          <IconArrowLeft size={20} strokeWidth={2} />
        </Link>
        {tool.client.logoUrl ? (
          <img src={tool.client.logoUrl} alt={tool.client.name} className="h-8 w-auto object-contain" />
        ) : (
          <span className="text-sm font-medium text-zinc-400">{tool.client.name}</span>
        )}
        <span className="flex-1 text-sm font-medium text-zinc-100 truncate">{tool.name}</span>
        <a
          href={tool.powerbiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          title="Tela cheia"
        >
          <IconMaximize size={20} strokeWidth={2} />
        </a>
      </header>
      <div className="flex-1 min-h-0">
        <iframe
          src={tool.powerbiUrl}
          title={tool.name}
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
