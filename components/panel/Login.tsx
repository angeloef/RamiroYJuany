'use client';

import { useActionState } from 'react';
import { entrar } from '@/app/panel/actions';
import s from './panel.module.css';

export default function Login() {
  const [estado, accion, enviando] = useActionState(entrar, null);

  return (
    <main className={s.login}>
      <form action={accion} className={s.loginCaja}>
        <p className={`caps ${s.eyebrow}`}>Panel de los novios</p>
        <h1 className={s.loginTitulo}>Ramiro <span>&amp;</span> Juany</h1>
        <p className={s.loginBajada}>Mirá las fotos en vivo y ocultá las que no querés en la galería.</p>

        <label className={s.campo}>
          <span className="caps">Usuario</span>
          <input name="usuario" defaultValue={estado?.usuario} key={estado?.usuario} autoComplete="username" autoCapitalize="none" required />
        </label>
        <label className={s.campo}>
          <span className="caps">Clave</span>
          <input name="clave" type="password" autoComplete="current-password" required />
        </label>

        <p className={s.error} role="alert" aria-live="polite">{estado?.error}</p>

        <button className={`caps ${s.primario}`} disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
