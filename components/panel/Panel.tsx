'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { salir } from '@/app/panel/actions';
import s from './panel.module.css';

type Estado = 'publicada' | 'oculta';
type Foto = {
  id: string; thumb: string; web: string; estado: Estado;
  width: number; height: number; subida: string; mesa: string;
};
type Filtro = 'todas' | Estado;

// ponytail: polling cada 5s; SSE/websocket si el panel se usa con muchos a la vez
const CADA_MS = 5000;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export default function Panel() {
  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [mesa, setMesa] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [conectado, setConectado] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const vistas = useRef<Set<string> | null>(null);
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  // mientras hay un cambio en vuelo, el polling no pisa el estado optimista
  const pendientes = useRef(new Map<string, Estado>());

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/panel/fotos', { cache: 'no-store' });
      if (r.status === 401) return location.reload();
      if (!r.ok) throw new Error(String(r.status));
      const { fotos: llegadas } = (await r.json()) as { fotos: Foto[] };
      const conPendientes = llegadas.map((f) =>
        pendientes.current.has(f.id) ? { ...f, estado: pendientes.current.get(f.id)! } : f);

      if (vistas.current) {
        const frescas = conPendientes.filter((f) => !vistas.current!.has(f.id)).map((f) => f.id);
        if (frescas.length) setNuevas((prev) => new Set([...prev, ...frescas]));
      }
      vistas.current = new Set(conPendientes.map((f) => f.id));
      setFotos(conPendientes);
      setConectado(true);
    } catch {
      setConectado(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(() => document.visibilityState === 'visible' && cargar(), CADA_MS);
    const alVolver = () => document.visibilityState === 'visible' && cargar();
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [cargar]);

  const cambiar = useCallback(async (ids: string[], estado: Estado) => {
    if (!ids.length || !fotos) return;
    const antes = new Map(fotos.filter((f) => ids.includes(f.id)).map((f) => [f.id, f.estado]));
    ids.forEach((id) => pendientes.current.set(id, estado));
    setFotos((prev) => prev && prev.map((f) => (ids.includes(f.id) ? { ...f, estado } : f)));

    try {
      const r = await fetch('/api/panel/fotos', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, estado }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setAviso(`${ids.length === 1 ? 'Foto' : `${ids.length} fotos`} ${estado === 'oculta' ? 'oculta' : 'visible'}${ids.length > 1 ? 's' : ''} en la galería`);
    } catch {
      setFotos((prev) => prev && prev.map((f) => (antes.has(f.id) ? { ...f, estado: antes.get(f.id)! } : f)));
      setAviso('No se pudo guardar. Revisá la conexión y probá de nuevo.');
    } finally {
      ids.forEach((id) => pendientes.current.delete(id));
    }
  }, [fotos]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  const mesas = useMemo(
    () => [...new Set((fotos ?? []).map((f) => f.mesa))]
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    [fotos],
  );
  const cuenta = useMemo(() => ({
    todas: fotos?.length ?? 0,
    publicada: fotos?.filter((f) => f.estado === 'publicada').length ?? 0,
    oculta: fotos?.filter((f) => f.estado === 'oculta').length ?? 0,
  }), [fotos]);
  const visibles = useMemo(
    () => (fotos ?? []).filter((f) => (filtro === 'todas' || f.estado === filtro) && (!mesa || f.mesa === mesa)),
    [fotos, filtro, mesa],
  );

  const modoSeleccion = seleccion.size > 0;
  const alternarSeleccion = (id: string) => setSeleccion((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const aplicarSeleccion = (estado: Estado) => {
    cambiar([...seleccion], estado);
    setSeleccion(new Set());
  };

  const tocar = (f: Foto) => {
    // el click que sigue a una pulsacion larga no tiene que deseleccionar
    if (largo.current) { largo.current = false; return; }
    if (modoSeleccion) return alternarSeleccion(f.id);
    setNuevas((prev) => { const n = new Set(prev); n.delete(f.id); return n; });
    setAbierta(f.id);
  };

  // pulsacion larga en el celular = empezar a seleccionar
  const presion = useRef<ReturnType<typeof setTimeout> | null>(null);
  const largo = useRef(false);
  const empezarPresion = (id: string) => {
    largo.current = false;
    presion.current = setTimeout(() => { presion.current = null; largo.current = true; alternarSeleccion(id); navigator.vibrate?.(15); }, 450);
  };
  const cortarPresion = () => { if (presion.current) clearTimeout(presion.current); };

  const indice = visibles.findIndex((f) => f.id === abierta);
  const actual = indice >= 0 ? visibles[indice] : null;
  const mover = useCallback((paso: number) => {
    const sig = visibles[indice + paso];
    if (sig) setAbierta(sig.id);
  }, [visibles, indice]);

  useEffect(() => {
    if (!actual) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(null);
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
      if (e.key.toLowerCase() === 'h') cambiar([actual.id], actual.estado === 'oculta' ? 'publicada' : 'oculta');
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [actual, mover, cambiar]);

  // swipe horizontal en el visor
  const toque = useRef<number | null>(null);

  return (
    <div className={s.app}>
      <header className={s.barra}>
        <div className={s.marca}>
          <p className={`caps ${s.eyebrow}`}>
            <span className={conectado ? s.enVivo : s.desconectado} aria-hidden />
            {conectado ? 'En vivo' : 'Sin conexión'}
          </p>
          <h1 className={s.titulo}>Fotos de la fiesta</h1>
        </div>
        <form action={salir}>
          <button className={`caps ${s.fantasma}`}>Salir</button>
        </form>
      </header>

      <section className={s.resumen} aria-label="Resumen">
        <div><strong>{cuenta.todas}</strong><span className="caps">subidas</span></div>
        <div><strong>{cuenta.publicada}</strong><span className="caps">en galería</span></div>
        <div className={s.resumenOculta}><strong>{cuenta.oculta}</strong><span className="caps">ocultas</span></div>
      </section>

      <nav className={s.filtros} aria-label="Filtros">
        <div className={s.pestanas} role="tablist">
          {(['todas', 'publicada', 'oculta'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filtro === f}
              className={`caps ${s.pestana}`} onClick={() => setFiltro(f)}>
              {f === 'todas' ? 'Todas' : f === 'publicada' ? 'Visibles' : 'Ocultas'}
            </button>
          ))}
        </div>
        <label className={s.selectMesa}>
          <span className="caps">Mesa</span>
          <select value={mesa} onChange={(e) => setMesa(e.target.value)}>
            <option value="">Todas</option>
            {mesas.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      </nav>

      {nuevas.size > 0 && (
        <button className={`caps ${s.nuevas}`} onClick={() => { setNuevas(new Set()); scrollTo({ top: 0, behavior: 'smooth' }); }}>
          {nuevas.size} {nuevas.size === 1 ? 'foto nueva' : 'fotos nuevas'} ↑
        </button>
      )}

      <main className={s.contenido}>
        {fotos === null && <p className={s.vacio}>Cargando fotos…</p>}
        {fotos !== null && visibles.length === 0 && (
          <p className={s.vacio}>
            {cuenta.todas === 0 ? 'Todavía no subieron fotos. Aparecen acá apenas llegan.' : 'No hay fotos con este filtro.'}
          </p>
        )}
        <ul className={s.grilla}>
          {visibles.map((f) => (
            <li key={f.id}
              className={s.celda}
              data-oculta={f.estado === 'oculta' || undefined}
              data-sel={seleccion.has(f.id) || undefined}
              data-nueva={nuevas.has(f.id) || undefined}>
              <button className={s.miniatura}
                onClick={() => tocar(f)}
                onPointerDown={() => empezarPresion(f.id)}
                onPointerUp={cortarPresion} onPointerLeave={cortarPresion}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={`Foto de ${f.mesa}, ${hora(f.subida)}${f.estado === 'oculta' ? ', oculta' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.thumb} alt="" loading="lazy" decoding="async" draggable={false} />
                <span className={`caps ${s.etiqueta}`}>{f.mesa} · {hora(f.subida)}</span>
                {f.estado === 'oculta' && <span className={`caps ${s.sello}`}>Oculta</span>}
                {modoSeleccion && <span className={s.check} aria-hidden>{seleccion.has(f.id) ? '✓' : ''}</span>}
              </button>
              {!modoSeleccion && (
                <button className={s.rapido}
                  onClick={() => cambiar([f.id], f.estado === 'oculta' ? 'publicada' : 'oculta')}
                  aria-label={f.estado === 'oculta' ? 'Mostrar en la galería' : 'Ocultar de la galería'}
                  title={f.estado === 'oculta' ? 'Mostrar' : 'Ocultar'}>
                  <Ojo tachado={f.estado !== 'oculta'} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {!modoSeleccion && visibles.length > 0 && (
          <p className={`caps ${s.pista}`}>Mantené apretada una foto para elegir varias</p>
        )}
      </main>

      {modoSeleccion && (
        <div className={s.accionesSel} role="toolbar" aria-label="Acciones sobre la selección">
          <button className={`caps ${s.fantasma}`} onClick={() => setSeleccion(new Set())}>Cancelar</button>
          <span className={s.selCuenta}>{seleccion.size}</span>
          <button className={`caps ${s.secundario}`} onClick={() => aplicarSeleccion('publicada')}>Mostrar</button>
          <button className={`caps ${s.primario}`} onClick={() => aplicarSeleccion('oculta')}>Ocultar</button>
        </div>
      )}

      {actual && (
        <div className={s.visor} role="dialog" aria-modal="true" aria-label={`Foto de ${actual.mesa}`}
          onClick={(e) => e.target === e.currentTarget && setAbierta(null)}
          onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (toque.current === null) return;
            const dx = e.changedTouches[0].clientX - toque.current;
            if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
            toque.current = null;
          }}>
          <div className={s.visorArriba}>
            <p className="caps">{actual.mesa} · {hora(actual.subida)} · {indice + 1}/{visibles.length}</p>
            <button className={s.cerrar} onClick={() => setAbierta(null)} aria-label="Cerrar">✕</button>
          </div>
          <figure className={s.visorFoto} data-oculta={actual.estado === 'oculta' || undefined}
            onClick={(e) => e.target === e.currentTarget && setAbierta(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={actual.id} src={actual.web} alt={`Foto de ${actual.mesa}`} />
          </figure>
          <button className={`${s.flecha} ${s.flechaIzq}`} onClick={() => mover(-1)} disabled={indice === 0} aria-label="Anterior">‹</button>
          <button className={`${s.flecha} ${s.flechaDer}`} onClick={() => mover(1)} disabled={indice === visibles.length - 1} aria-label="Siguiente">›</button>
          <div className={s.visorAbajo}>
            <p className={`caps ${s.visorEstado}`}>
              {actual.estado === 'oculta' ? 'Oculta: los invitados no la ven' : 'Visible en la galería'}
            </p>
            {actual.estado === 'oculta'
              ? <button className={`caps ${s.secundario}`} onClick={() => cambiar([actual.id], 'publicada')}>Mostrar en galería</button>
              : <button className={`caps ${s.primario}`} onClick={() => cambiar([actual.id], 'oculta')}>Ocultar de galería</button>}
          </div>
        </div>
      )}

      <p className={`caps ${s.aviso}`} role="status" aria-live="polite" data-visible={Boolean(aviso) || undefined}>{aviso}</p>
    </div>
  );
}

function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <path d="M4 4l16 16" />}
    </svg>
  );
}
