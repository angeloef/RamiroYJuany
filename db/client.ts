import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

// ponytail: una sola conexion por proceso; Render corre 1-2 instancias
export const sql = postgres(process.env.DATABASE_URL!, { max: 5 });
export const db = drizzle(sql, { schema });
