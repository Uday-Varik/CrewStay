/// <reference types="node" />

import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Did you set it in .env?");
}

export default {
  out: "./migrations",
  schema: "./shared/schema.ts",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
};
