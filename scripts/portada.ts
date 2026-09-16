/**
 * Sube las fotos de los novios a la galeria como una seccion propia, aparte de
 * las mesas: `tsx scripts/portada.ts <carpeta>`.
 *
 * Son fotos ya elegidas, no fotos de invitados: van por un token revocado (nadie
 * puede subir con el) y con fecha anterior a la fiesta, para que queden al final
 * del feed y la galeria las muestre como portada.
 *
 * De cada foto sube tres archivos: el original, una version "web" para el visor y
 * una miniatura para las grillas. Correrlo de nuevo sobre la misma carpeta no
 * duplica nada: las fotos que ya estan solo les regenera las derivadas si les faltan.
 */
import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
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

// el lado largo de cada derivada: la miniatura sirve celdas de ~180px en 2x
const LADO_WEB = 1600;
const LADO_THUMB = 400;

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

// las fotos vienen repetidas entre los zips de WhatsApp: una sola por contenido.
// El sha guardado en phash tambien dice cuales ya estan en la base.
const existentes = new Map(
  (await db.select({ id: photos.id, phash: photos.phash, derivadas: photos.derivadas })
    .from(photos).where(eq(photos.guestTokenId, token.id)))
    .map((f) => [f.phash ?? '', f]),
);
const vistas = new Set<string>();
let subidas = 0;
let rehechas = 0;
let salteadas = 0;

const subir = (key: string, cuerpo: Buffer) => s3.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET,
  Key: key,
  Body: cuerpo,
  ContentType: 'image/jpeg',
  // la key lleva el uuid de la foto: el archivo nunca cambia de contenido
  CacheControl: 'public, max-age=31536000, immutable',
}));

/** Version mas chica, con la rotacion del EXIF ya aplicada al pixel. */
const encoger = (cuerpo: Buffer, lado: number) => sharp(cuerpo)
  .rotate()
  // el JPEG no tiene canal alfa: lo transparente se apoya en el fondo del cajon
  .flatten({ background: '#17130f' })
  .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 78, progressive: true, mozjpeg: true })
  .toBuffer({ resolveWithObject: true });

for (const [i, nombre] of archivos.entries()) {
  const cuerpo = readFileSync(join(CARPETA, nombre));
  const hash = createHash('sha256').update(cuerpo).digest('hex').slice(0, 32);
  if (vistas.has(hash)) { salteadas += 1; continue; }
  vistas.add(hash);

  const ya = existentes.get(hash);
  if (ya?.derivadas) { salteadas += 1; continue; }

  // si la foto ya estaba pero sin derivadas, se le agregan sin insertarla de nuevo
  const id = ya?.id ?? randomUUID();
  const base = `${evento.id}/${id}`;
  const [web, thumb] = await Promise.all([encoger(cuerpo, LADO_WEB), encoger(cuerpo, LADO_THUMB)]);

  await Promise.all([
    ya ? Promise.resolve() : subir(`${base}/orig.jpg`, cuerpo),
    subir(`${base}/web.jpg`, web.data),
    subir(`${base}/thumb.jpg`, thumb.data),
  ]);

  const derivadas = {
    keyOriginal: `${base}/orig.jpg`,
    keyWeb: `${base}/web.jpg`,
    keyThumb: `${base}/thumb.jpg`,
    derivadas: true,
    // las medidas son las de la version web, que es la que se mira
    width: web.info.width,
    height: web.info.height,
  };
  const kb = (n: number) => `${Math.round(n / 1024)} kB`;

  if (ya) {
    await db.update(photos).set(derivadas).where(eq(photos.id, id));
    rehechas += 1;
    console.log(`  ~ ${nombre} ${web.info.width}x${web.info.height} web ${kb(web.data.length)} thumb ${kb(thumb.data.length)}`);
  } else {
    await db.insert(photos).values({
      ...derivadas,
      id,
      eventId: evento.id,
      guestTokenId: token.id,
      mime: 'image/jpeg',
      bytes: cuerpo.length,
      phash: hash, // el sha del archivo: alcanza para no repetir subidas
      // el orden del feed es por fecha descendente: el primer archivo queda primero
      takenAt: new Date(DESDE.getTime() - i * 60_000),
    });
    subidas += 1;
    console.log(`  ${String(subidas).padStart(2)} ${nombre} ${web.info.width}x${web.info.height} web ${kb(web.data.length)} thumb ${kb(thumb.data.length)}`);
  }
}

await db.update(guestTokens).set({ usos: existentes.size + subidas })
  .where(eq(guestTokens.id, token.id));

console.log(`
"${SECCION}": ${subidas} nuevas, ${rehechas} con derivadas nuevas, ${salteadas} sin cambios.`);
await sql.end();
