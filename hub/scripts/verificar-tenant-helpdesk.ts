/**
 * Verifica se o tenant do Helpdesk está configurado para os clientes.
 * Uso: npx tsx scripts/verificar-tenant-helpdesk.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { withHelpdeskDb } from "../src/lib/helpdesk-db";

async function main() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  console.log(`\nClientes ativos: ${clients.length}\n`);

  for (const c of clients) {
    const tenant = await prisma.helpdeskTenant.findUnique({
      where: { clientId: c.id },
    });
    if (!tenant) {
      console.log(`  [${c.name}] (${c.id}) -> SEM tenant. Rode: npm run migrate-helpdesk`);
      continue;
    }
    try {
      const [tickets, tipos] = await Promise.all([
        withHelpdeskDb(c.id, (p) => p.query("SELECT COUNT(*)::int AS n FROM hd_ticket", []).then((r) => r.rows[0].n)),
        withHelpdeskDb(c.id, (p) => p.query("SELECT COUNT(*)::int AS n FROM hd_tipo_solicitacao", []).then((r) => r.rows[0].n)),
      ]);
      console.log(`  [${c.name}] (${c.id}) -> OK. Banco: ${tenant.dbName}. Tickets: ${tickets}, Tipos: ${tipos}`);
    } catch (err) {
      console.log(`  [${c.name}] (${c.id}) -> Tenant existe mas ERRO ao conectar:`, err instanceof Error ? err.message : err);
    }
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
