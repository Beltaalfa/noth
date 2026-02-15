import { prisma } from "@/lib/prisma";
import { NegociacoesForm } from "@/components/negociacoes/NegociacoesForm";

export default async function AdminNegociacoesPage() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clientes = clients.map((c) => ({ id: c.id, name: c.name }));

  return <NegociacoesForm clientes={clientes} />;
}
