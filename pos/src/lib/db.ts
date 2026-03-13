import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:1234@localhost:5432/pos_db";

export const pgPool =
  global.pgPool ||
  new Pool({
    connectionString,
  });

if (!global.pgPool) {
  global.pgPool = pgPool;
}

