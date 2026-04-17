import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const email = process.env.ADMIN_SEED_EMAIL?.toLowerCase().trim();
const password = process.env.ADMIN_SEED_PASSWORD;
const name = process.env.ADMIN_SEED_NAME ?? "Admin";

if (!email || !password) {
  console.info("Skipping seed: set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD to create an admin user.");
  process.exit(0);
}

const adminPassword = password;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, password: hash },
    update: { name, password: hash },
  });
  console.info(`Seeded admin user: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
