import { randomBytes } from 'node:crypto';
import { db, sql } from './client.js';
import { events, guestTokens } from './schema.js';

const SLUG = process.env.SEED_SLUG ?? 'ana-y-tomas';
const MESAS = Number(process.env.SEED_MESAS ?? 20);
const BASE_URL = process.env.BASE_URL ?? 'https://boda.example';

// 16 chars base64url ~ 96 bits: impracticable de adivinar, corto para un QR
const nuevoToken = () => randomBytes(12).toString('base64url');

const [evento] = await db.insert(events).values({
  slug: SLUG,
  nombre: 'Ana y Tomás',
  fecha: '2026-11-14',
  estado: 'activo',
  config: { cuotaPorToken: 40, maxBytes: 25 * 1024 * 1024 },
}).onConflictDoNothing().returning();

if (!evento) {
  console.error(`El evento "${SLUG}" ya existe. Borralo o usá SEED_SLUG=otro.`);
  await sql.end();
  process.exit(1);
}

const tokens = await db.insert(guestTokens).values(
  Array.from({ length: MESAS }, (_, i) => ({
    eventId: evento.id,
    token: nuevoToken(),
    label: `Mesa ${i + 1}`,
  })),
).returning();

console.log(`\nEvento ${evento.nombre} (${evento.slug})`);
console.log(`Galería pública: ${BASE_URL}/e/${evento.slug}\n`);
console.log('QR por mesa:');
for (const t of tokens) console.log(`  ${t.label.padEnd(8)} ${BASE_URL}/e/${evento.slug}/subir?t=${t.token}`);
console.log('');

await sql.end();
