import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClientIdsForNegociacoes } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { NegociacoesForm } from "@/components/negociacoes/NegociacoesForm";

export default async function NegociacoesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");
  const isAdmin = (session.user as { role?: string })?.role === "admin";

  const clientIds = await getClientIdsForNegociacoes(userId, isAdmin);

  if (clientIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-8">
        <h1 className="text-xl font-semibold text-zinc-100">Sem permissão</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Você não tem acesso à ferramenta Negociações ou ela não está configurada para seus clientes. Verifique em Admin se o cliente tem Negociações ativo (Clientes → Ferramentas) e se sua liberação está marcada (Usuários → Liberações de funções).
        </p>
      </div>
    );
  }

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, deletedAt: null, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clientes = clients.map((c) => ({ id: c.id, name: c.name }));

  return <NegociacoesForm clientes={clientes} />;
}
