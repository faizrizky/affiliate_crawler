import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/auth/password";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEFAULT_TEMPLATES = [
  {
    name: "Review Short",
    content:
      "Honestly {{product}} is doing more for me than I expected in {{context}}. If you've been looking, here's the one I'd grab: {{affiliate_link}}",
  },
  {
    name: "Best-of List",
    content:
      "After a month of testing, {{product}} is my top pick in {{category}}. Full breakdown + where to get it: {{affiliate_link}}",
  },
];

async function main() {
  for (const template of DEFAULT_TEMPLATES) {
    const variables = [
      ...new Set([...template.content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])),
    ];
    await prisma.template.upsert({
      where: { name: template.name },
      update: { content: template.content, variables },
      create: { name: template.name, content: template.content, variables },
    });
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = hashPassword(adminPassword);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash },
      create: { email: adminEmail, name: "Admin", passwordHash },
    });
    console.log(`Seeded admin user ${adminEmail}`);
  }
  console.log(`Seeded ${DEFAULT_TEMPLATES.length} default templates`);
}

main().finally(() => prisma.$disconnect());
