/**
 * Atribui todos os Grupos (e indiretamente os Setores) ao cliente "Rede PMG".
 * Crie o cliente "Rede PMG" em Admin → Clientes antes de rodar, se não existir.
 *
 * Uso: npx tsx scripts/atribuir-clientes-pmg.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não definido. Configure no .env");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const CLIENTE_NOME = "Rede PMG";

async function main() {
  const cliente = await prisma.client.findFirst({
    where: { name: { equals: CLIENTE_NOME, mode: "insensitive" }, deletedAt: null },
  });
  if (!cliente) {
    console.error(`Cliente "${CLIENTE_NOME}" não encontrado. Crie em Admin → Clientes e rode de novo.`);
    process.exit(1);
  }

  const result = await prisma.group.updateMany({
    where: {},
    data: { clientId: cliente.id },
  });
  console.log(`Atribuídos ${result.count} grupo(s) ao cliente ${CLIENTE_NOME} (id: ${cliente.id}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
