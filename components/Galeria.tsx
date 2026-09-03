'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Foto } from '@/lib/fotos';
import styles from './Galeria.module.css';

export function Galeria({ slug, inicial, hayMasInicial }: {
  slug: string; inicial: Foto[]; hayMasInicial: boolean;
}) {
  const [fotos, setFotos] = useState(inicial);
  const [hayMas, setHayMas] = useState(hayMasInicial);
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);

  async function verMas() {
    const ultima = fotos[fotos.length - 1];
    if (!ultima || cargando) return;
    setCargando(true);
    try {
      const r = await fetch(`/api/fotos?slug=${encodeURIComponent(slug)}&cuando=${encodeURIComponent(ultima.cuando)}&id=${ultima.id}`);
      const data = await r.json();
      setFotos((prev) => [...prev, ...data.fotos]);
      setHayMas(data.hayMas);
    } finally {
      setCargando(false);
    }
  }

  const mover = useCallback((paso: number) => {
    setAbierta((i) => (i === null ? null : Math.min(fotos.length - 1, Math.max(0, i + paso))));
  }, [fotos.length]);

  useEffect(() => {
    if (abierta === null) return;
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null);
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    document.addEventListener('keydown', teclas);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', teclas); document.body.style.overflow = ''; };
  }, [abierta, mover]);

  // swipe: el 95% del trafico es un celular
  let x0 = 0;
  const tocar = {
    onTouchStart: (e: React.TouchEvent) => { x0 = e.changedTouches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 60) mover(dx < 0 ? 1 : -1);
    },
  };

  if (fotos.length === 0) {
    return <p className={styles.vacio}>Todavía no hay fotos. Las primeras son las de tu mesa.</p>;
  }

  const foto = abierta === null ? null : fotos[abierta];

  return (
    <>
      <ul className={styles.grilla}>
        {fotos.map((f, i) => (
          <li key={f.id}>
            <button type="button" className={styles.celda} onClick={() => setAbierta(i)} aria-label={`Ver foto ${i + 1} de ${fotos.length}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.thumb} alt="" width={f.width} height={f.height} loading={i < 12 ? 'eager' : 'lazy'} decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      {hayMas && (
        <button type="button" className={styles.mas} onClick={verMas} disabled={cargando}>
          {cargando ? 'Cargando…' : 'Ver más fotos'}
        </button>
      )}

      {foto && (
        <div className={styles.visor} role="dialog" aria-modal="true" onClick={() => setAbierta(null)} {...tocar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto.web} alt="" width={foto.width} height={foto.height} onClick={(e) => e.stopPropagation()} />
          <button type="button" className={styles.cerrar} onClick={() => setAbierta(null)} aria-label="Cerrar">×</button>
          <nav className={styles.flechas} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => mover(-1)} disabled={abierta === 0} aria-label="Anterior">‹</button>
            <a href={foto.web} download aria-label="Descargar esta foto">Descargar</a>
            <button type="button" onClick={() => mover(1)} disabled={abierta === fotos.length - 1} aria-label="Siguiente">›</button>
          </nav>
        </div>
      )}
    </>
  );
}
