import Image from 'next/image';
import styles from './Hero.module.css';

// Sin 'use client': la entrada del hero es CSS puro. Animarla por JS la deja a merced
// del hilo principal, que en el arranque está ocupado; opacity/transform van al compositor.
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-nombres">
      <div className={styles.media}>
        <Image
          src="/hero.webp"
          alt="Ramiro y Juany alejándose en un descapotable rojo por un camino de ripio"
          fill
          priority
          fetchPriority="high"
          sizes="(min-width: 900px) 50vw, 100vw"
        />
      </div>
      <div className={styles.scrim} />

      <div className={styles.content}>
        <div className={styles.top}>
          <div className={`${styles.fecha} caps`} data-reveal>
            <span className={styles.rule} />
            <span>19 · 09 · 2026</span>
            <span className={styles.rule} />
          </div>

          <h1 id="hero-nombres" className={styles.nombres} data-reveal>
            <span>Ramiro</span>
            <span className={styles.amp}>&amp;</span>
            <span>Juany</span>
          </h1>

          <div className={`${styles.casamos} caps`} data-reveal>
            ¡Nos casamos!
          </div>

          <p className={styles.intro} data-reveal>
            Después de varios años de compartir nuestras vidas juntos, tomamos la hermosa decisión de
            recibir la bendición de Dios
          </p>
        </div>

        <div className={styles.bottom}>
          <div className={styles.datos} data-reveal>
            <span>Iglesia Santa Teresita · 21:00</span>
            <span>Cena · Salón Ucraniano</span>
          </div>

          <div className={styles.acciones} data-reveal>
            <a href="/e/ramiro-y-juany/subir" className={`${styles.primario} caps`}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                <circle cx="12" cy="13.5" r="3.5" />
              </svg>
              Subí tus fotos
            </a>
            <a href="/e/ramiro-y-juany" className={`${styles.secundario} caps`}>
              Ver la galería
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
