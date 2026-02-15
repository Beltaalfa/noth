import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { canUserAccessTool } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function FerramentaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  const { slug } = await params;
  const tool = await prisma.tool.findFirst({
    where: { slug, status: "active" },
  });

  if (!tool) notFound();

  const canAccess = await canUserAccessTool(userId, tool.id);
  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <h1 className="text-2xl font-bold text-zinc-100">Sem permissão</h1>
        <p className="text-zinc-500 mt-2">
          Você não tem acesso a esta ferramenta.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100">{tool.name}</h1>
      {tool.description && (
        <p className="text-zinc-500 mt-2">{tool.description}</p>
      )}
      <p className="text-zinc-500 mt-4">
        Conteúdo da ferramenta será carregado aqui (Tool Runner).
      </p>
    </div>
  );
}
