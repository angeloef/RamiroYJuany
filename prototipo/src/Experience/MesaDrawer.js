/**
 * El cajon de una mesa: se abre desde el recorrido principal (una portada por mesa)
 * y muestra todas las fotos de esa mesa en una grilla, con un visor a pantalla
 * completa para recorrerlas de a una.
 *
 * ponytail: el visor es un strip horizontal con scroll-snap nativo. El swipe, la
 * inercia y el momentum los pone el navegador; aca solo se leen. Si algun dia hace
 * falta zoom con dos dedos, el techo es meter una libreria de gestos por foto.
 */
class MesaDrawer {
  constructor(gallery) {
    this.gallery = gallery
    this.element = null
    this.fotos = []

    this.onAbrir = (event) => this.abrir(event.detail?.index ?? -1)
    this.onTecla = (event) => {
      if (this.element?.hidden) return
      if (event.key === 'Escape') this.cerrarVisorOCajon()
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

    element.querySelector('.mesa__cerrar').addEventListener('click', () => this.cerrar())
    element.querySelector('.mesa__visor-cerrar').addEventListener('click', () => this.cerrarVisor())
    element.querySelector('.mesa__anterior').addEventListener('click', () => this.mover(-1))
    element.querySelector('.mesa__siguiente').addEventListener('click', () => this.mover(1))
    this.stripElement.addEventListener('scroll', () => this.actualizarContador(), { passive: true })

    document.body.append(element)
    document.addEventListener('mesa:abrir', this.onAbrir)
    window.addEventListener('keydown', this.onTecla)

    this.element = element
  }

  abrir(planeIndex) {
    const plane = this.gallery.planes[planeIndex]
    const fotos = plane?.userData.fotos || []
    if (!fotos.length) return

    this.fotos = fotos
    this.tituloElement.textContent = `${plane.userData.label?.word || 'mesa'} · ${fotos.length} ${
      fotos.length === 1 ? 'foto' : 'fotos'
    }`

    this.grillaElement.replaceChildren(
      ...fotos.map((foto, i) => {
        const boton = document.createElement('button')
        boton.type = 'button'
        boton.className = 'mesa__thumb'
        boton.innerHTML = `<img src="${foto.thumb}" alt="" loading="lazy" width="${foto.width}" height="${foto.height}">`
        boton.addEventListener('click', () => this.abrirVisor(i))
        return boton
      })
    )
    this.grillaElement.scrollTop = 0

    this.element.hidden = false
    document.body.classList.add('mesa-abierta')
  }

  cerrar() {
    this.cerrarVisor()
    this.element.hidden = true
    document.body.classList.remove('mesa-abierta')
  }

  cerrarVisorOCajon() {
    if (this.visorElement.hidden) this.cerrar()
    else this.cerrarVisor()
  }

  abrirVisor(index) {
    this.stripElement.replaceChildren(
      ...this.fotos.map((foto) => {
        const figura = document.createElement('figure')
        figura.className = 'mesa__foto'
        figura.innerHTML = `<img src="${foto.web}" alt="" loading="lazy">`
        return figura
      })
    )

    this.visorElement.hidden = false
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
    document.removeEventListener('mesa:abrir', this.onAbrir)
    window.removeEventListener('keydown', this.onTecla)
    this.element?.remove()
    this.element = null
    document.body.classList.remove('mesa-abierta')
  }
}

export { MesaDrawer }
