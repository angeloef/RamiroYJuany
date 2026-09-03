'use client';

import { useRef, useState } from 'react';
import styles from './Subir.module.css';

type Estado = 'espera' | 'subiendo' | 'listo' | 'error';
type Item = { key: number; file: File; estado: Estado; motivo?: string };

const LADO_WEB = 2048;
const LADO_THUMB = 400;
const EN_PARALELO = 2;

/** Derivadas en el navegador. null = el navegador no pudo decodificar el archivo. */
async function derivar(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const escalar = (lado: number, calidad: number) => {
      const f = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * f);
      canvas.height = Math.round(bitmap.height * f);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob>((ok, mal) =>
        canvas.toBlob((b) => (b ? ok(b) : mal(new Error('canvas vacio'))), 'image/jpeg', calidad));
    };
    const [web, thumb] = await Promise.all([escalar(LADO_WEB, 0.82), escalar(LADO_THUMB, 0.75)]);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { web, thumb, ...dims };
  } catch {
    return null;
  }
}

/** PUT directo a R2, con reintento exponencial: el 4G del salón se corta. */
async function put(url: string, body: Blob, tipo: string) {
  for (let intento = 0; ; intento++) {
    try {
      const r = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': tipo } });
      if (r.ok) return;
      if (r.status < 500 && r.status !== 429) throw new Error(`PUT ${r.status}`);
    } catch (e) {
      if (intento >= 3) throw e;
    }
    if (intento >= 3) throw new Error('PUT falló');
    await new Promise((r) => setTimeout(r, 600 * 2 ** intento));
  }
}

const postJson = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error ?? 'error'), { code: data.error });
  return data;
};

const MOTIVOS: Record<string, string> = {
  cuota: 'La mesa ya llegó al tope de fotos',
  formato: 'No pudimos subir esta: no es una foto',
  tamano: 'La foto pesa más de 25 MB',
  'sin-token': 'Escaneá otra vez el QR de tu mesa',
};

export function Subir({ slug, usos, cuota }: { slug: string; usos: number; cuota: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [subidas, setSubidas] = useState(usos);
  const input = useRef<HTMLInputElement>(null);
  const proximaKey = useRef(0);

  const marcar = (key: number, estado: Estado, motivo?: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, estado, motivo } : i)));

  async function subirUno(item: Item) {
    marcar(item.key, 'subiendo');
    const d = await derivar(item.file);

    const { id, keys, puts } = await postJson('/api/uploads/sign', {
      slug, mime: item.file.type, bytes: item.file.size,
      derivadas: Boolean(d), bytesWeb: d?.web.size, bytesThumb: d?.thumb.size,
    });

    // primero lo chico: aparece antes en la galería
    if (d) {
      await put(puts.thumb, d.thumb, 'image/jpeg');
      await put(puts.web, d.web, 'image/jpeg');
    }
    await put(puts.original, item.file, item.file.type);

    const r = await postJson('/api/uploads/commit', {
      slug, id, keys, derivadas: Boolean(d), mime: item.file.type, bytes: item.file.size,
      width: d?.width, height: d?.height, takenAt: new Date(item.file.lastModified).toISOString(),
    });
    setSubidas(r.usos);
    marcar(item.key, 'listo');
  }

  async function encolar(files: File[]) {
    const nuevos = files.map((file) => ({ key: proximaKey.current++, file, estado: 'espera' as Estado }));
    setItems((prev) => [...prev, ...nuevos]);

    const cola = [...nuevos];
    const worker = async () => {
      for (let item = cola.shift(); item; item = cola.shift()) {
        try {
          await subirUno(item);
        } catch (e) {
          const code = (e as { code?: string }).code;
          marcar(item.key, 'error', MOTIVOS[code ?? ''] ?? 'No se pudo subir. Probá de nuevo.');
        }
      }
    };
    await Promise.all(Array.from({ length: EN_PARALELO }, worker));
  }

  const pendientes = items.filter((i) => i.estado === 'espera' || i.estado === 'subiendo').length;
  const listas = items.filter((i) => i.estado === 'listo').length;
  const lleno = subidas >= cuota;

  return (
    <section className={styles.caja}>
      <input
        ref={input} type="file" accept="image/*" multiple hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) void encolar(files);
        }}
      />

      <button type="button" className={styles.boton} disabled={lleno} onClick={() => input.current?.click()}>
        {items.length ? 'Agregar más fotos' : 'Elegir fotos'}
      </button>

      <p className={styles.cuota}>
        {lleno
          ? `Tu mesa ya subió sus ${cuota} fotos. ¡Gracias!`
          : `${subidas} de ${cuota} fotos de tu mesa`}
      </p>

      {items.length > 0 && (
        <>
          <p className={styles.progreso} aria-live="polite">
            {pendientes ? `Subiendo… ${listas} de ${items.length}` : `Listo, ${listas} ${listas === 1 ? 'foto' : 'fotos'}`}
          </p>
          <ul className={styles.lista}>
            {items.map((i) => (
              <li key={i.key} className={styles.item} data-estado={i.estado}>
                <span className={styles.nombre}>{i.file.name}</span>
                <span className={styles.estado}>
                  {i.estado === 'listo' ? 'lista' : i.estado === 'error' ? i.motivo : i.estado === 'subiendo' ? 'subiendo…' : 'en cola'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
