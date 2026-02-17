import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required for seed");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminHash = await bcrypt.hash("admin123", 12);
  const gabrielHash = await bcrypt.hash("8421", 12);

  const adm = await prisma.user.upsert({
    where: { email: "admin@northempresarial.com" },
    update: { name: "ADM", role: "admin", status: "active" },
    create: {
      email: "admin@northempresarial.com",
      name: "ADM",
      passwordHash: adminHash,
      role: "admin",
      status: "active",
    },
  });

  const gabriel = await prisma.user.upsert({
    where: { email: "gabriel.oliveira@lgzsolucoes.com.br" },
    update: { name: "Gabriel", role: "admin", status: "active" },
    create: {
      email: "gabriel.oliveira@lgzsolucoes.com.br",
      name: "Gabriel",
      passwordHash: gabrielHash,
      role: "admin",
      status: "active",
    },
  });

  console.log("Seed concluído. ADM:", adm.email, "| Gabriel:", gabriel.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
