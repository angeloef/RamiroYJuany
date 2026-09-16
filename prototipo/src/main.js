/**
 * Camino crítico: sólo el hero. La galería (three.js) se importa después, cuando el
 * navegador está libre — así la entrada del hero no compite con el parseo del bundle.
 */

import { traerPagina } from './data/evento'

const canvas = document.querySelector('.webgl')
const hero = document.querySelector('.hero')

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing .webgl canvas element in index.html')
}

// Scroll.js clampea scrollTarget a 0 en la primera foto, asi que el "seguir tirando
// para arriba" se cuenta aparte: este es el empuje acumulado que trae el hero de vuelta
const EMPUJE_PARA_VOLVER = 320

let engine = null
let cargando = null
let heroVisible = true
let empujeArriba = 0
let touchY = 0
// true mientras se esta desarmando el historial: evita empujar entradas nuevas
let volviendo = false
// true mientras se espera que la galeria termine de cargar para entrar
let saliendoDelHero = false

/* -------------------------------------------------------------- galeria ---- */

function cargarGaleria() {
  if (cargando) return cargando

  // el feed y el chunk viajan juntos: esperar uno y despues el otro sumaba casi
  // un segundo antes de la primera portada
  const primeraPagina = traerPagina()

  cargando = import('./gallery.js')
    .then(({ bootGallery }) => bootGallery(canvas, primeraPagina))
    .then(async (instancia) => {
      engine = instancia
      // no alcanza con que el motor exista: la transicion tiene que entrar con
      // un frame ya pintado, si no el invitado ve el canvas vacio
      await new Promise((listo) => requestAnimationFrame(() => listo()))
      // queda en el performance del navegador: sirve para medir el arranque real
      performance.mark('galeria-lista')
      // Engine.init() ya enganchó wheel/touch en window; si el hero sigue arriba,
      // la galería queda en silencio hasta que el invitado entre
      aplicarEstadoDeScroll()
      return instancia
    })
    .catch((error) => {
      console.error('No se pudo iniciar la galería', error)
      cargando = null
    })

  return cargando
}

// arranca en cuanto el hero esta pintado: el chunk, el feed y las portadas tardan
// ~1,5s en cadena, y esos bytes se piden mientras el invitado lee la portada.
// Antes esperaba al idle con 2,5s de tope y el primer scroll se comia la espera.
requestAnimationFrame(() => requestAnimationFrame(cargarGaleria))

/* ------------------------------------------------------------------ hero ---- */

// la galeria escucha wheel/touch en window y no se puede tapar con un overlay:
// mientras el hero esta arriba se le pone la velocidad de scroll en cero
function aplicarEstadoDeScroll() {
  if (!engine) return
  engine.scroll.wheelScrollSpeed = heroVisible ? 0 : 1
  engine.scroll.touchScrollSpeed = heroVisible ? 0 : 1.8
}

function mostrarHero() {
  if (heroVisible) return
  // si la galeria dejo una entrada en el historial, se sale por el "atras":
  // popstate vuelve a llamar aca con volviendo en true
  if (!volviendo && history.state?.vista) {
    history.back()
    return
  }
  heroVisible = true
  empujeArriba = 0

  if (engine) engine.scroll.scrollTarget = 0
  aplicarEstadoDeScroll()

  hero.classList.remove('is-hidden')
  // un frame con display restaurado antes de sacar is-gone, si no la transición no corre
  requestAnimationFrame(() => hero.classList.remove('is-gone'))
}

async function ocultarHero() {
  if (!heroVisible || saliendoDelHero) return
  saliendoDelHero = true

  // si la galeria todavia no esta lista, el hero se queda y avisa: mejor esperar
  // un momento que cortar a un canvas vacio
  hero.classList.add('is-esperando')
  await cargarGaleria()
  hero.classList.remove('is-esperando')
  saliendoDelHero = false

  // mientras esperaba puede haber vuelto (o no haber arrancado nunca la galeria)
  if (!heroVisible || !engine) return

  heroVisible = false
  empujeArriba = 0

  hero.classList.add('is-gone')
  aplicarEstadoDeScroll()
  entrarA('galeria')
}

/* ------------------------------------------------------------- historial ---- */

/**
 * El "atras" del celular tiene que volver a la seccion anterior, no salir del
 * sitio: cada vista (galeria, album, foto) deja una entrada en el historial y
 * el back las desarma de a una. El hero es la entrada original: desde ahi si
 * corresponde salir.
 */
function entrarA(vista) {
  if (volviendo) return
  history.pushState({ vista }, '')
}

// las vistas del cajon las abre MesaDrawer, que avisa por evento
document.addEventListener('vista:entrar', (event) => entrarA(event.detail?.vista))
// cerrar con un boton o con Escape es lo mismo que apretar "atras"
document.addEventListener('vista:salir', () => {
  if (history.state?.vista) history.back()
})

window.addEventListener('popstate', (event) => {
  volviendo = true
  const vista = event.state?.vista ?? 'hero'
  // el cajon cierra lo que corresponda segun la vista a la que se vuelve
  document.dispatchEvent(new CustomEvent('vista:atras', { detail: { vista } }))
  if (vista === 'hero') mostrarHero()
  volviendo = false
})

hero.addEventListener('transitionend', (event) => {
  if (event.propertyName === 'opacity' && !heroVisible) hero.classList.add('is-hidden')
})

/* ---------------------------------------------------------------- scroll ---- */

function onScrollInput(deltaY) {
  // con el album abierto el scroll es del cajon: ni entra al hero ni vuelve a el
  if (document.body.classList.contains('mesa-abierta')) {
    empujeArriba = 0
    return
  }

  if (heroVisible) {
    // hacia abajo entra a la galeria; hacia arriba no hace nada
    if (deltaY > 0) ocultarHero()
    return
  }

  // ya en la galeria: solo cuenta el empuje hacia arriba estando en la primera foto
  if (deltaY >= 0 || !engine || engine.scroll.scrollTarget > 1) {
    empujeArriba = 0
    return
  }

  empujeArriba += -deltaY
  if (empujeArriba >= EMPUJE_PARA_VOLVER) mostrarHero()
}

window.addEventListener('wheel', (event) => onScrollInput(event.deltaY), { passive: true })
window.addEventListener(
  'touchstart',
  (event) => {
    touchY = event.touches[0]?.clientY ?? 0
  },
  { passive: true },
)
window.addEventListener(
  'touchmove',
  (event) => {
    const currentY = event.touches[0]?.clientY ?? touchY
    onScrollInput(touchY - currentY)
    touchY = currentY
  },
  { passive: true },
)

document.querySelector('[data-ver-galeria]')?.addEventListener('click', ocultarHero)
