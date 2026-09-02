/**
 * Camino crítico: sólo el hero. La galería (three.js) se importa después, cuando el
 * navegador está libre — así la entrada del hero no compite con el parseo del bundle.
 */

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

/* -------------------------------------------------------------- galeria ---- */

function cargarGaleria() {
  if (cargando) return cargando

  cargando = import('./gallery.js')
    .then(({ bootGallery }) => bootGallery(canvas))
    .then((instancia) => {
      engine = instancia
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

// se precarga cuando el navegador termina lo urgente, no en el arranque
if ('requestIdleCallback' in window) {
  requestIdleCallback(cargarGaleria, { timeout: 2500 })
} else {
  setTimeout(cargarGaleria, 1200)
}

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
  heroVisible = true
  empujeArriba = 0

  if (engine) engine.scroll.scrollTarget = 0
  aplicarEstadoDeScroll()

  hero.classList.remove('is-hidden')
  // un frame con display restaurado antes de sacar is-gone, si no la transición no corre
  requestAnimationFrame(() => hero.classList.remove('is-gone'))
}

function ocultarHero() {
  if (!heroVisible) return
  heroVisible = false
  empujeArriba = 0

  cargarGaleria()
  hero.classList.add('is-gone')
  aplicarEstadoDeScroll()
}

hero.addEventListener('transitionend', (event) => {
  if (event.propertyName === 'opacity' && !heroVisible) hero.classList.add('is-hidden')
})

/* ---------------------------------------------------------------- scroll ---- */

function onScrollInput(deltaY) {
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
