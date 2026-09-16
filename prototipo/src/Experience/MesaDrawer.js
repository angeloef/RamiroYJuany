/**
 * El cajon de una mesa: se abre desde el recorrido principal (una portada por mesa)
 * y muestra todas las fotos de esa mesa en tres columnas, con un visor a pantalla
 * completa para recorrerlas de a una.
 *
 * Las columnas se mueven con el scroll como el demo "On Scroll Columns & Rows" #2
 * de Codrops (MIT): la del medio va mas rapido y las de los costados se inclinan
 * hacia afuera. Sin Lenis: en el celular el scroll suavizado por JS pelea con el
 * momentum nativo y se siente peor que el del sistema.
 *
 * ponytail: el visor es un strip horizontal con scroll-snap nativo. El swipe, la
 * inercia y el momentum los pone el navegador; aca solo se leen. Si algun dia hace
 * falta zoom con dos dedos, el techo es meter una libreria de gestos por foto.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const COLUMNAS = 3
// con pocas fotos tres columnas quedan raquiticas y desparejas
const COLUMNAS_POCAS = 2
const POCAS_FOTOS = 5
// los valores del demo #2: la columna del medio adelanta y las otras se abren.
// El demo usa yPercent: -20, pero con 19 filas eso son ~1400px y la columna del
// medio termina en el aire. Aca el adelanto se mide en celdas y se compensa con
// padding abajo, asi el hueco no se ve.
const ADELANTO_EN_CELDAS = 0.55
// menos que esto de scroll y el movimiento no se llega a leer: mejor quieto
const MINIMO_PARA_MOVER = 240
const GIRO = 6
const CORRIMIENTO = 10

const quietoPorAccesibilidad = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

class MesaDrawer {
  constructor(gallery) {
    this.gallery = gallery
    this.element = null
    this.fotos = []
    this.columnas = []
    this.scrolls = []

    this.onAbrir = (event) => this.abrir(event.detail?.index ?? -1)
    // el adelanto y el corrimiento van en px: al cambiar el ancho hay que recalcularlos
    this.onResize = () => {
      if (this.element?.hidden) return
      clearTimeout(this.esperaResize)
      this.esperaResize = setTimeout(() => this.animarColumnas(), 150)
    }
    // volver atras (boton, Escape o el "atras" del celular) es siempre lo mismo
    this.onAtras = (event) => {
      const vista = event.detail?.vista
      if (vista === 'album') this.cerrarVisor()
      else if (vista === 'galeria' || vista === 'hero') this.cerrar()
    }
    this.pedirAtras = () => document.dispatchEvent(new CustomEvent('vista:salir'))

    this.onTecla = (event) => {
      if (this.element?.hidden) return
      if (event.key === 'Escape') this.pedirAtras()
      if (event.key === 'ArrowRight') this.mover(1)
      if (event.key === 'ArrowLeft') this.mover(-1)
    }
  }

  init() {
    if (this.element) return

    const element = document.createElement('section')
    element.className = 'mesa'
    element.hidden = true
    element.innerHTML = `
      <header class="mesa__barra">
        <p class="mesa__titulo"></p>
        <button type="button" class="mesa__cerrar" aria-label="Volver al recorrido">Volver</button>
      </header>
      <div class="mesa__grilla"></div>
      <div class="mesa__visor" hidden>
        <div class="mesa__strip"></div>
        <p class="mesa__contador"></p>
        <button type="button" class="mesa__visor-cerrar" aria-label="Cerrar la foto">Cerrar</button>
        <button type="button" class="mesa__anterior" aria-label="Foto anterior">‹</button>
        <button type="button" class="mesa__siguiente" aria-label="Foto siguiente">›</button>
      </div>
    `

    this.tituloElement = element.querySelector('.mesa__titulo')
    this.grillaElement = element.querySelector('.mesa__grilla')
    this.visorElement = element.querySelector('.mesa__visor')
    this.stripElement = element.querySelector('.mesa__strip')
    this.contadorElement = element.querySelector('.mesa__contador')

    element.querySelector('.mesa__cerrar').addEventListener('click', this.pedirAtras)
    element.querySelector('.mesa__visor-cerrar').addEventListener('click', this.pedirAtras)
    element.querySelector('.mesa__anterior').addEventListener('click', () => this.mover(-1))
    element.querySelector('.mesa__siguiente').addEventListener('click', () => this.mover(1))
    this.stripElement.addEventListener('scroll', () => this.actualizarContador(), { passive: true })

    document.body.append(element)
    document.addEventListener('mesa:abrir', this.onAbrir)
    document.addEventListener('vista:atras', this.onAtras)
    window.addEventListener('keydown', this.onTecla)
    window.addEventListener('resize', this.onResize)

    this.element = element
  }

  abrir(planeIndex) {
    const plane = this.gallery.planes[planeIndex]
    const fotos = plane?.userData.fotos || []
    if (!fotos.length) return

    this.fotos = fotos
    // el nombre de la mesa sale de la base: va como texto, nunca como HTML
    const cuantas = document.createElement('small')
    cuantas.textContent = `${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}`
    this.tituloElement.replaceChildren(plane.userData.label?.word || 'mesa', cuantas)

    this.pintarColumnas(fotos)
    this.grillaElement.scrollTop = 0

    this.element.hidden = false
    document.body.classList.add('mesa-abierta')
    document.dispatchEvent(new CustomEvent('vista:entrar', { detail: { vista: 'album' } }))
    // el scroll se arma con el cajon ya visible: antes las medidas son todas cero
    requestAnimationFrame(() => this.animarColumnas())
  }

  /**
   * Reparte las fotos en tres columnas en zigzag, para que el orden se siga
   * leyendo de izquierda a derecha, y deja cada foto envuelta: el wrapper es el
   * que gira, la foto adentro no se deforma.
   */
  pintarColumnas(fotos) {
    const cuantasColumnas = fotos.length <= POCAS_FOTOS
      ? Math.min(COLUMNAS_POCAS, fotos.length)
      : COLUMNAS
    this.grillaElement.style.setProperty('--mesa-columnas', String(cuantasColumnas))

    this.columnas = Array.from({ length: cuantasColumnas }, () => {
      const columna = document.createElement('div')
      columna.className = 'mesa__col'
      return columna
    })

    fotos.forEach((foto, i) => {
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'mesa__thumb'
      boton.setAttribute('aria-label', `Ver la foto ${i + 1} de ${fotos.length}`)

      const marco = document.createElement('span')
      marco.className = 'mesa__thumb-marco'

      const img = document.createElement('img')
      img.src = foto.thumb
      img.alt = ''
      img.loading = 'lazy'
      img.decoding = 'async'
      // la celda es cuadrada: las medidas son para que el navegador reserve el lugar
      img.width = 400
      img.height = 400
      img.draggable = false

      marco.append(img)
      boton.append(marco)
      boton.addEventListener('click', () => this.abrirVisor(i))
      this.columnas[i % this.columnas.length].append(boton)
    })

    this.grillaElement.replaceChildren(...this.columnas)
  }

  /** El movimiento del demo #2, atado al scroll del propio cajon. */
  animarColumnas() {
    this.matarScroll()
    this.grillaElement.style.setProperty('--mesa-adelanto', '0px')
    this.grillaElement.style.setProperty('--mesa-corrimiento', '0px')
    if (quietoPorAccesibilidad()) return

    // sin scroll no hay efecto posible: el rango del trigger queda degenerado y
    // las fotos se quedan inclinadas a mitad de camino, sin que nada se mueva
    const alcanza = this.grillaElement.scrollHeight - this.grillaElement.clientHeight
    if (alcanza < MINIMO_PARA_MOVER) return

    const comun = { scroller: this.grillaElement, scrub: true }
    const celda = this.columnas[0].firstElementChild?.getBoundingClientRect().height || 0
    const adelanto = Math.round(celda * ADELANTO_EN_CELDAS)
    // el hueco que deja la columna del medio se rellena con padding, no con aire
    this.grillaElement.style.setProperty('--mesa-adelanto', `${adelanto}px`)
    this.grillaElement.style.setProperty('--mesa-corrimiento', `${Math.round(celda * CORRIMIENTO / 100)}px`)

    // con dos columnas no hay una del medio: las dos se abren hacia afuera
    const medio = this.columnas.length === COLUMNAS ? 1 : -1

    this.scrolls = medio < 0 ? [] : [
      gsap.to(this.columnas[medio], {
        ease: 'none',
        y: -adelanto,
        scrollTrigger: { ...comun, trigger: this.grillaElement, start: 'clamp(top bottom)', end: 'clamp(bottom top)' },
      }),
    ]

    this.columnas.forEach((columna, pos) => {
      if (pos === medio) return
      const haciaIzquierda = pos === 0

      for (const boton of columna.children) {
        this.scrolls.push(gsap.to(boton.querySelector('.mesa__thumb-marco'), {
          ease: 'none',
          startAt: { transformOrigin: haciaIzquierda ? '0% 100%' : '100% 100%' },
          rotation: haciaIzquierda ? -GIRO : GIRO,
          xPercent: haciaIzquierda ? -CORRIMIENTO : CORRIMIENTO,
          scrollTrigger: { ...comun, trigger: boton, start: 'clamp(top bottom)', end: 'clamp(bottom top)' },
        }))
      }
    })
  }

  matarScroll() {
    this.scrolls?.forEach((t) => t.scrollTrigger?.kill())
    this.scrolls?.forEach((t) => t.kill())
    this.scrolls = []
  }

  cerrar() {
    this.matarScroll()
    this.cerrarVisor()
    this.element.hidden = true
    document.body.classList.remove('mesa-abierta')
  }

  abrirVisor(index) {
    this.stripElement.replaceChildren(
      ...this.fotos.map((foto) => {
        const figura = document.createElement('figure')
        figura.className = 'mesa__foto'
        const img = document.createElement('img')
        img.src = foto.web
        img.alt = ''
        img.loading = 'lazy'
        img.decoding = 'async'
        img.width = foto.width
        img.height = foto.height
        img.draggable = false
        figura.append(img)
        return figura
      })
    )

    this.visorElement.hidden = false
    document.dispatchEvent(new CustomEvent('vista:entrar', { detail: { vista: 'foto' } }))
    this.irA(index, 'auto')
  }

  cerrarVisor() {
    this.visorElement.hidden = true
    this.stripElement.replaceChildren()
  }

  indiceActual() {
    const ancho = this.stripElement.clientWidth || 1
    return Math.round(this.stripElement.scrollLeft / ancho)
  }

  irA(index, behavior = 'smooth') {
    const destino = Math.max(0, Math.min(index, this.fotos.length - 1))
    this.stripElement.scrollTo({ left: destino * this.stripElement.clientWidth, behavior })
    this.actualizarContador(destino)
  }

  mover(paso) {
    if (this.visorElement.hidden) return
    this.irA(this.indiceActual() + paso)
  }

  actualizarContador(index = this.indiceActual()) {
    this.contadorElement.textContent = `${index + 1} / ${this.fotos.length}`
  }

  dispose() {
    this.matarScroll()
    document.removeEventListener('mesa:abrir', this.onAbrir)
    document.removeEventListener('vista:atras', this.onAtras)
    window.removeEventListener('keydown', this.onTecla)
    window.removeEventListener('resize', this.onResize)
    clearTimeout(this.esperaResize)
    this.element?.remove()
    this.element = null
    document.body.classList.remove('mesa-abierta')
  }
}

export { MesaDrawer }
