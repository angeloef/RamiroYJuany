/**
 * Hoja imprimible con el QR de cada mesa: `npm run qr` y se abre qr-mesas.html.
 * Es un script y no una ruta web a propósito: la página lista los 22 tokens, y
 * cualquiera que diera con esa URL podría subir fotos como cualquier mesa.
 */
import { writeFile } from 'node:fs/promises';
import { eq, isNull, and, asc } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db, sql } from '../db/client';
import { events, guestTokens } from '../db/schema';

const SLUG = process.env.SEED_SLUG ?? 'ramiro-y-juany';
const BASE_URL = (process.env.BASE_URL ?? 'https://ramiro-y-juany.onrender.com').replace(/\/$/, '');
const SALIDA = process.env.QR_SALIDA ?? 'qr-mesas.html';

const [evento] = await db.select().from(events).where(eq(events.slug, SLUG)).limit(1);
if (!evento) {
  console.error(`No existe el evento "${SLUG}". Corré primero npm run db:seed.`);
  await sql.end();
  process.exit(1);
}

const mesas = await db.select({ token: guestTokens.token, label: guestTokens.label })
  .from(guestTokens)
  .where(and(eq(guestTokens.eventId, evento.id), isNull(guestTokens.revocadoEn)))
  .orderBy(asc(guestTokens.creadoEn));

const tarjetas = await Promise.all(mesas.map(async (mesa) => {
  const url = `${BASE_URL}/e/${evento.slug}/subir?t=${mesa.token}`;
  // margin 2 = el quiet zone que el escáner necesita; sin eso falla en mesas con mantel oscuro
  const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
  return `<article class="tarjeta">
      <p class="novios">${evento.nombre}</p>
      <h2>${mesa.label}</h2>
      <div class="qr">${svg}</div>
      <p class="pedido">Escaneá y subí tus fotos</p>
      <p class="url">${url.replace(/^https:\/\//, '')}</p>
    </article>`;
}));

const html = `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<title>QR por mesa · ${evento.nombre}</title>
<style>
  @page { size: A4; margin: 12mm; }
  :root { --tinta: #2b2320; --dorado: #b08d57; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f1ea; color: var(--tinta);
         font-family: "Jost", "Segoe UI", system-ui, sans-serif; }
  .hoja { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; padding: 10mm; max-width: 210mm; margin: 0 auto; }
  .tarjeta { background: #fff; border: 1px solid #e2dacb; border-radius: 2mm;
             padding: 8mm 6mm; text-align: center; display: flex; flex-direction: column;
             align-items: center; gap: 3mm; page-break-inside: avoid; break-inside: avoid; }
  .novios { margin: 0; font-size: 8pt; letter-spacing: .18em; text-transform: uppercase; color: var(--dorado); }
  h2 { margin: 0; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 500; font-size: 24pt; }
  .qr { width: 45mm; height: 45mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .pedido { margin: 0; font-size: 10pt; }
  .url { margin: 0; font-family: ui-monospace, "Courier New", monospace; font-size: 7pt; color: #6d6559; word-break: break-all; }
  .ayuda { max-width: 210mm; margin: 8mm auto 0; padding: 0 10mm; font-size: 9pt; color: #6d6559; }
  @media print { body { background: #fff; } .ayuda { display: none; } .tarjeta { border-color: #ccc; } }
</style>
<div class="hoja">${tarjetas.join('\n')}</div>
<p class="ayuda">${mesas.length} tarjetas · imprimir en A4, 4 por hoja, sin escalar.
  El QR tiene que quedar de 4 cm de lado o más, negro sobre papel claro.</p>
`;

await writeFile(SALIDA, html, 'utf8');
console.log(`${mesas.length} tarjetas en ${SALIDA} (apuntando a ${BASE_URL})`);
await sql.end();
