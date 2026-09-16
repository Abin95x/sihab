import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { sihabPool?: Pool; sihabDb?: Db };

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Db {
  if (globalForDb.sihabDb) return globalForDb.sihabDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const pool = (globalForDb.sihabPool ??= new Pool({ connectionString, max: 5 }));
  globalForDb.sihabDb = drizzle({ client: pool, schema });
  return globalForDb.sihabDb;
}
