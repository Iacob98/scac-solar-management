import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use Supabase DB URL or fallback to DATABASE_URL
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set. Did you forget to configure your database connection?",
  );
}

export const pool = new Pool({
  connectionString,
  ssl: false,
  options: '-c search_path=public'
});
export const db = drizzle(pool, { schema });