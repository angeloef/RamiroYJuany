import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { events } from '@/db/schema';
import { feed } from '@/lib/fotos';
import { Galeria } from '@/components/Galeria';
import styles from './galeria.module.css';

export const dynamic = 'force-dynamic';

export default async function GaleriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [evento] = await db.select({ nombre: events.nombre }).from(events).where(eq(events.slug, slug)).limit(1);
  if (!evento) notFound();

  const { fotos, hayMas } = await feed(slug);

  return (
    <main className={styles.main}>
      <header className={styles.cabecera}>
        <h1 className={styles.titulo}>Las fotos de la fiesta</h1>
        <p className={styles.bajada}>{evento.nombre}</p>
        <Link className={styles.subir} href={`/e/${slug}/subir`}>Subir las mías</Link>
      </header>
      <Galeria slug={slug} inicial={fotos} hayMasInicial={hayMas} />
    </main>
  );
}
