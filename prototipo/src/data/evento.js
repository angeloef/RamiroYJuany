/** Datos del evento que necesitan tanto el hero como la galeria. */
export const SLUG = import.meta.env.VITE_EVENTO_SLUG ?? 'ramiro-y-juany'

// una sola vuelta a la API en vez de varias: cada pagina extra era medio segundo
// antes de poder mostrar la primera portada
export const POR_PAGINA = 300

export const urlDelFeed = (cursor) => {
  const query = new URLSearchParams({ slug: SLUG, porPagina: String(POR_PAGINA) })
  if (cursor) {
    query.set('cuando', cursor.cuando)
    query.set('id', cursor.id)
  }
  return `/api/fotos?${query}`
}

/** Una pagina del feed, o null si la API no contesta. */
export const traerPagina = (cursor) =>
  fetch(urlDelFeed(cursor))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`la API contesto ${r.status}`))))
    .catch((error) => {
      console.error('No se pudieron traer las fotos', error)
      return null
    })
