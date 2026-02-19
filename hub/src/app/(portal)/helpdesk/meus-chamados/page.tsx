import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClientsForHelpdesk } from "@/lib/permissions";
import { MeusChamadosPage } from "@/components/helpdesk/MeusChamadosPage";

export default async function MeusChamadosRoute() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");
  const isAdmin = (session.user as { role?: string })?.role === "admin";

  const clients = await getClientsForHelpdesk(userId, isAdmin);
  const clientes = clients.map((c) => ({ id: c.id, name: c.name }));

  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-8">
        <h1 className="text-xl font-semibold text-zinc-100">Sem permissão</h1>
        <p className="mt-2 text-sm text-zinc-500">Você não tem acesso a nenhum cliente para usar o Helpdesk.</p>
      </div>
    );
  }

  return <MeusChamadosPage clientes={clientes} />;
}
