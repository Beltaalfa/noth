import { prisma } from "@/lib/prisma";
import { HelpdeskPage } from "@/components/helpdesk/HelpdeskPage";

export default async function AdminHelpdeskPage() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clientes = clients.map((c) => ({ id: c.id, name: c.name }));

  return <HelpdeskPage clientes={clientes} />;
}
