import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClientIdsForCurvaABC } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CurvaABCForm } from "@/components/curva-abc/CurvaABCForm";

export default async function CurvaABCPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");
  const isAdmin = (session.user as { role?: string })?.role === "admin";

  const clientIds = await getClientIdsForCurvaABC(userId, isAdmin);

  if (clientIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-8">
        <h1 className="text-xl font-semibold text-zinc-100">Sem permissão</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Você não tem acesso ao relatório Curva ABC. Verifique se tem acesso a Negociações (Clientes → Ferramentas e Usuários → Liberações).
        </p>
      </div>
    );
  }

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, deletedAt: null },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
  const clientes = clients.map((c) => ({ id: c.id, name: c.name, status: c.status }));

  return <CurvaABCForm clientes={clientes} />;
}
