import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

/** Default HTTP neon client: rows as objects, not fullResults. */
export type Sql = NeonQueryFunction<false, false>;

let client: Sql | undefined;

function getClient(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and set DATABASE_URL (Neon).',
    );
  }
  client = neon(url);
  return client;
}

/** Single Neon access path — tagged template SQL (TZ §20.2). */
export const sql: Sql = ((strings: TemplateStringsArray, ...params: unknown[]) =>
  getClient()(strings, ...params)) as Sql;
