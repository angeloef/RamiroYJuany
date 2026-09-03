import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { firmarPut } from '@/lib/storage';
import { cuotaDe, maxBytesDe, mesaDeCookie } from '@/lib/token';

const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
};

export async function POST(req: Request) {
  const { slug, mime, bytes, derivadas, bytesWeb, bytesThumb } = await req.json();

  const mesa = await mesaDeCookie(String(slug ?? ''));
  if (!mesa) return NextResponse.json({ error: 'sin-token' }, { status: 401 });
  if (mesa.usos >= cuotaDe(mesa.config)) return NextResponse.json({ error: 'cuota' }, { status: 429 });

  if (!MIMES.includes(mime)) return NextResponse.json({ error: 'formato' }, { status: 415 });
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > maxBytesDe(mesa.config)) {
    return NextResponse.json({ error: 'tamano' }, { status: 413 });
  }

  const id = randomUUID();
  const base = `${mesa.eventId}/${id}`;
  const original = `${base}/orig.${EXT[mime]}`;

  // sin derivadas (el navegador no pudo decodificar): las 3 keys apuntan al original
  if (!derivadas) {
    const put = await firmarPut(original, mime, bytes);
    return NextResponse.json({ id, keys: { original, web: original, thumb: original }, puts: { original: put } });
  }

  const web = `${base}/web.jpg`;
  const thumb = `${base}/thumb.jpg`;
  const [pOriginal, pWeb, pThumb] = await Promise.all([
    firmarPut(original, mime, bytes),
    firmarPut(web, 'image/jpeg', Number(bytesWeb)),
    firmarPut(thumb, 'image/jpeg', Number(bytesThumb)),
  ]);

  return NextResponse.json({ id, keys: { original, web, thumb }, puts: { original: pOriginal, web: pWeb, thumb: pThumb } });
}
