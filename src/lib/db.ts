/**
 * Prisma client singleton.
 *
 * DATABASE_URL is read from the environment; the `.env` file in the project
 * root pins it to an absolute path inside this project's `db/` directory so
 * the SQLite file is fully isolated from the parent sandbox and any sibling
 * apps. In dev we cache the client on `globalThis` to avoid spawning a new
 * PrismaClient on every hot-reload.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
