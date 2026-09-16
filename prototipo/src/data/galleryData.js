import { traerPagina } from '@/data/evento'
import FLOWER01 from '@/assets/flower-01.webp'
import FLOWER02 from '@/assets/flower-02.webp'
import FLOWER03 from '@/assets/flower-03.webp'
import FLOWER04 from '@/assets/flower-04.webp'
import FLOWER05 from '@/assets/flower-05.webp'

const galleryPlaneData = [
  {
    fallbackColor: '#feca4f',
    accentColor: '#feca4f',
    textureSrc: FLOWER01,
    position: { x: -0.9, y: 0 },
    backgroundColor: '#fffaf0',
    blob1Color: '#ffdf94',
    blob2Color: '#fce7c4',
    label: {
      word: 'golden',
      pms: '—',
      color: '#2e2e2e',
    },
  },
  {
    fallbackColor: '#80455a',
    accentColor: '#80455a',
    textureSrc: FLOWER02,
    position: { x: 0.8, y: 0 },
    backgroundColor: '#fffaf0',
    blob1Color: '#d29a41',
    blob2Color: '#bb96af',
    label: {
      word: 'violet',
      pms: '—',
      color: '#2e2e2e',
    },
  },
  {
    fallbackColor: '#fa7b71',
    accentColor: '#fa7b71',
    textureSrc: FLOWER03,
    position: { x: -0.7, y: 0 },
    backgroundColor: '#5f81ab',
    blob1Color: '#f88b8d',
    blob2Color: '#cfbbdd',
    label: {
      word: 'afterglow',
      pms: '—',
      color: '#f4f4f4',
    },
  },
  {
    fallbackColor: '#3c72c6',
    accentColor: '#3c72c6',
    textureSrc: FLOWER04,
    position: { x: 1, y: 0 },
    backgroundColor: '#5b9bc2',
    blob1Color: '#ffaa00',
    blob2Color: '#00e1ff',
    label: {
      word: 'cobalt',
      pms: '—',
      color: '#f4f4f4',
    },
  },
  {
    fallbackColor: '#fdd895',
    accentColor: '#fdd895',
    textureSrc: FLOWER05,
    position: { x: -0.7, y: 0 },
    backgroundColor: '#7d936e',
    blob1Color: '#fdd895',
    blob2Color: '#a5b599',
    label: {
      word: 'meadow',
      pms: '—',
      color: '#f4f4f4',
    },
  },
]

export { galleryPlaneData }

/** Las posiciones y el ritmo de los planos del demo, para repetir en las fotos reales. */
const RITMO = galleryPlaneData.map((plane) => plane.position)

// ponytail: el tope evita un loop infinito si la API se pone rara
const MAX_PAGINAS = 20

const hora = (iso) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * Todas las fotos publicadas del evento, siguiendo el cursor del feed.
 * La primera pagina puede venir ya pedida desde main.js: se lanza junto con la
 * descarga del chunk en vez de esperarlo, que eran dos esperas en serie.
 */
async function traerTodas(primeraPagina) {
  const todas = []
  let pagina = await primeraPagina

  for (let vuelta = 0; vuelta < MAX_PAGINAS; vuelta += 1) {
    if (!pagina) break

    const { fotos, hayMas } = pagina
    todas.push(...fotos)
    if (!hayMas || !fotos.length) break

    const ultima = fotos[fotos.length - 1]
    pagina = await traerPagina({ cuando: ultima.cuando, id: ultima.id })
  }

  return todas
}

// la seccion de los novios: no es una mesa y abre el recorrido (scripts/portada.ts)
const PORTADA = 'Nuestro viaje hasta ahora'

/** "Mesa 7" -> 7. La portada va primera; lo que no tiene numero, al final. */
function numeroDeMesa(etiqueta) {
  if (etiqueta === PORTADA) return -Infinity
  const numero = Number.parseInt(etiqueta.match(/\d+/)?.[0] ?? '', 10)
  return Number.isFinite(numero) ? numero : Infinity
}

/**
 * Agrupa por mesa. Las mesas van por numero — el recorrido tiene que leerse como
 * el plano del salon — y dentro de cada una las fotos quedan como el feed, de la
 * mas nueva a la mas vieja.
 */
function agruparPorMesa(fotos) {
  const mesas = new Map()

  fotos.forEach((foto) => {
    const mesa = foto.mesa || 'boda'
    if (!mesas.has(mesa)) mesas.set(mesa, [])
    mesas.get(mesa).push(foto)
  })

  return [...mesas.entries()].sort(
    ([a], [b]) => numeroDeMesa(a) - numeroDeMesa(b) || a.localeCompare(b, 'es')
  )
}

/**
 * Reemplaza las flores de muestra por UNA portada por mesa: el recorrido principal
 * tiene tantos planos como mesas, y cada plano se abre en su propio cajon de fotos.
 * Si todavia no hay ninguna (o la API no contesta) se queda con las flores:
 * la galeria nunca aparece vacia.
 */
export async function cargarFotosReales(primeraPagina) {
  try {
    const fotos = await traerTodas(primeraPagina)
    if (!fotos.length) return false

    const planos = agruparPorMesa(fotos).map(([mesa, fotosDeLaMesa], i) => ({
      // los colores los pisa aplicarMoodAutomatico con los de la propia portada
      fallbackColor: '#d9c9b4',
      accentColor: '#d9c9b4',
      textureSrc: fotosDeLaMesa[0].web,
      position: RITMO[i % RITMO.length],
      backgroundColor: '#fffaf0',
      blob1Color: '#f0e0c8',
      blob2Color: '#e4d3bd',
      fotos: fotosDeLaMesa,
      esPortada: mesa === PORTADA,
      label: {
        word: mesa,
        // el numeral grande del HUD es el numero de la mesa, no la posicion en
        // el recorrido: "Mesa 1" tiene que decir 01
        numero: Number.isFinite(numeroDeMesa(mesa)) ? numeroDeMesa(mesa) : null,
        // la portada no lleva hora: no es un momento de la fiesta
        pms: mesa === PORTADA ? '' : hora(fotosDeLaMesa[0].cuando),
        color: '#2e2e2e',
      },
    }))

    // se muta el array en su lugar: Gallery.js ya se quedo con esta referencia
    galleryPlaneData.splice(0, galleryPlaneData.length, ...planos)
    return true
  } catch (error) {
    console.error('No se pudieron traer las fotos, queda la galeria de muestra', error)
    return false
  }
}
