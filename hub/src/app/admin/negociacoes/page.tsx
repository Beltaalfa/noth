import { prisma } from "@/lib/prisma";
import { NegociacoesForm } from "@/components/negociacoes/NegociacoesForm";

export default async function AdminNegociacoesPage() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
  const clientes = clients.map((c) => ({ id: c.id, name: c.name, status: c.status }));

  return <NegociacoesForm clientes={clientes} />;
}
