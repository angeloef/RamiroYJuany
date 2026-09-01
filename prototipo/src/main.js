import '@/css/base.css'
import '@/css/canvas.css'
import '@/css/hero.css'

import gsap from 'gsap'
import { Engine } from '@/Experience/Engine'
import { galleryPlaneData } from '@/data/galleryData'
import { aplicarMoodAutomatico } from '@/data/mood'

const canvas = document.querySelector('.webgl')

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing .webgl canvas element in index.html')
}

const engine = new Engine(canvas)

// la paleta de cada plano sale de su propia foto, no de colores escritos a mano
aplicarMoodAutomatico(galleryPlaneData)
  .then(() => engine.init())
  .catch((error) => {
    console.error('Engine initialization failed', error)
  })

/* ---------------------------------------------------------------- hero ---- */

const hero = document.querySelector('.hero')
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (!prefersReducedMotion) {
  gsap
    .timeline({ defaults: { ease: 'power3.out' } })
    .from('[data-media]', { scale: 1.08, duration: 2.4, ease: 'power2.out' })
    .from('[data-reveal]', { opacity: 0, y: 26, duration: 1.1, stagger: 0.14 }, 0.25)
}

// la galeria escucha wheel/touch en window y hace preventDefault, asi que no se puede
// tapar con un overlay: mientras el hero esta arriba se le pone la velocidad en cero
const SCROLL_SPEED = { wheel: engine.scroll.wheelScrollSpeed, touch: engine.scroll.touchScrollSpeed }

// Scroll.js clampea scrollTarget a 0 en la primera foto, asi que el "seguir tirando
// para arriba" se cuenta aparte: este es el empuje acumulado que trae el hero de vuelta
const EMPUJE_PARA_VOLVER = 320

let heroVisible = true
let heroTween = null
let empujeArriba = 0

function galleryEnabled(isEnabled) {
  engine.scroll.wheelScrollSpeed = isEnabled ? SCROLL_SPEED.wheel : 0
  engine.scroll.touchScrollSpeed = isEnabled ? SCROLL_SPEED.touch : 0
}

galleryEnabled(false)

function showHero() {
  if (heroVisible) return
  heroVisible = true

  galleryEnabled(false)
  engine.scroll.scrollTarget = 0
  empujeArriba = 0

  hero.style.display = ''
  hero.classList.remove('is-gone')
  heroTween?.kill()
  heroTween = gsap.to(hero, {
    opacity: 1,
    duration: prefersReducedMotion ? 0 : 0.5,
    ease: 'power2.out',
  })
}

function hideHero() {
  if (!heroVisible) return
  heroVisible = false

  hero.classList.add('is-gone')
  heroTween?.kill()
  heroTween = gsap.to(hero, {
    opacity: 0,
    duration: prefersReducedMotion ? 0 : 0.7,
    ease: 'power2.inOut',
    onComplete: () => {
      hero.style.display = 'none'
      empujeArriba = 0
      galleryEnabled(true)
    },
  })
}

let touchY = 0

function onScrollInput(deltaY) {
  if (heroVisible) {
    // hacia abajo entra a la galeria; hacia arriba no hace nada
    if (deltaY > 0) hideHero()
    return
  }

  // ya en la galeria: solo cuenta el empuje hacia arriba estando en la primera foto
  if (deltaY >= 0 || engine.scroll.scrollTarget > 1) {
    empujeArriba = 0
    return
  }

  empujeArriba += -deltaY
  if (empujeArriba >= EMPUJE_PARA_VOLVER) showHero()
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

document.querySelector('[data-ver-galeria]')?.addEventListener('click', hideHero)
