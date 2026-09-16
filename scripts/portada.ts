/**
 * Sube las fotos de los novios a la galeria como una seccion propia, aparte de
 * las mesas: `tsx scripts/portada.ts <carpeta>`.
 *
 * Son fotos ya elegidas, no fotos de invitados: van por un token revocado (nadie
 * puede subir con el) y con fecha anterior a la fiesta, para que queden al final
 * del feed y la galeria las muestre como portada.
 *
 * ponytail: sube el jpeg tal cual en las 3 keys (derivadas: false), igual que
 * cuando el navegador no puede decodificar. Si la galeria se pone pesada, el
 * paso que falta es generar web/thumb con sharp aca mismo.
 */
import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { db, sql } from '../db/client';
import { events, guestTokens, photos } from '../db/schema';

const CARPETA = process.argv[2];
const SLUG = process.env.SEED_SLUG ?? 'ramiro-y-juany';
export const SECCION = 'Nuestro viaje hasta ahora';
// antes de la fiesta: el feed ordena por fecha, asi la seccion no se mezcla
const DESDE = new Date('2026-09-01T12:00:00Z');

if (!CARPETA) {
  console.error('Uso: tsx scripts/portada.ts <carpeta con las fotos>');
  process.exit(1);
}

/** Ancho y alto leidos del header del JPEG, sin decodificar la imagen. */
function medidas(buf: Buffer) {
  for (let i = 2; i + 9 < buf.length; ) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marca = buf[i + 1];
    const largo = buf.readUInt16BE(i + 2);
    // SOF0..SOF15, salvo los marcadores que no son de trama (C4, C8, CC)
    if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + largo;
  }
  return { width: 0, height: 0 };
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const [evento] = await db.select({ id: events.id }).from(events).where(eq(events.slug, SLUG));
if (!evento) throw new Error(`No existe el evento "${SLUG}"`);

// el token de la seccion es uno solo: si el script se corre de nuevo, reusa el mismo
const [existente] = await db.select().from(guestTokens)
  .where(and(eq(guestTokens.eventId, evento.id), eq(guestTokens.label, SECCION)));
const token = existente ?? (await db.insert(guestTokens).values({
  eventId: evento.id,
  label: SECCION,
  token: randomBytes(12).toString('base64url'),
  revocadoEn: new Date(), // no es una mesa: no se sube con este token
}).returning())[0];

const archivos = readdirSync(CARPETA)
  .filter((n) => ['.jpg', '.jpeg'].includes(extname(n).toLowerCase()))
  .sort();

// las fotos vienen repetidas entre los zips de WhatsApp: una sola por contenido
const yaSubidas = new Set(
  (await db.select({ phash: photos.phash }).from(photos)
    .where(eq(photos.guestTokenId, token.id))).map((f) => f.phash),
);
const vistas = new Set<string>();
let subidas = 0;
let salteadas = 0;

for (const [i, nombre] of archivos.entries()) {
  const cuerpo = readFileSync(join(CARPETA, nombre));
  const hash = createHash('sha256').update(cuerpo).digest('hex').slice(0, 32);
  if (vistas.has(hash) || yaSubidas.has(hash)) { salteadas += 1; continue; }
  vistas.add(hash);

  const id = randomUUID();
  const key = `${evento.id}/${id}/orig.jpg`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: cuerpo,
    ContentType: 'image/jpeg',
  }));

  const { width, height } = medidas(cuerpo);
  await db.insert(photos).values({
    id,
    eventId: evento.id,
    guestTokenId: token.id,
    keyOriginal: key, keyWeb: key, keyThumb: key,
    derivadas: false,
    mime: 'image/jpeg',
    bytes: cuerpo.length,
    width, height,
    phash: hash, // aca guarda el sha del archivo: alcanza para no repetir subidas
    // el orden del feed es por fecha descendente: el primer archivo queda primero
    takenAt: new Date(DESDE.getTime() - i * 60_000),
  });

  subidas += 1;
  console.log(`  ${String(subidas).padStart(2)} ${nombre} ${width}x${height}`);
}

await db.update(guestTokens).set({ usos: subidas + (existente?.usos ?? 0) })
  .where(eq(guestTokens.id, token.id));

console.log(`\n"${SECCION}": ${subidas} fotos subidas, ${salteadas} repetidas salteadas.`);
await sql.end();
