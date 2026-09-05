/**
 * El HUD del recorrido: numero de mesa, cuantas fotos tiene y la puerta de entrada
 * a su cajon. Nada mas — las fichas de color (CMYK/RGB/HEX) eran del demo de
 * pantones del que salio esta galeria y no pintan nada en una boda.
 */
class Label {
  constructor(gallery) {
    this.gallery = gallery

    this.overlayElement = null
    this.numeroElement = null
    this.nombreElement = null
    this.conteoElement = null
    this.horaElement = null
    this.entrarElement = null
    this.recorridoElement = null
    this.activePlaneIndex = -1
  }

  createElement() {
    const element = document.createElement('section')
    element.className = 'hud'
    element.innerHTML = `
      <p class="hud__recorrido"></p>
      <div class="hud__mesa">
        <p class="hud__numero"></p>
        <span class="hud__regla"></span>
        <p class="hud__nombre"></p>
      </div>
      <div class="hud__pie">
        <p class="hud__conteo"><span class="hud__cuantas"></span><span class="hud__hora"></span></p>
        <button type="button" class="hud__entrar" hidden>Ver la mesa</button>
      </div>
    `

    return {
      element,
      numeroElement: element.querySelector('.hud__numero'),
      nombreElement: element.querySelector('.hud__nombre'),
      conteoElement: element.querySelector('.hud__cuantas'),
      horaElement: element.querySelector('.hud__hora'),
      entrarElement: element.querySelector('.hud__entrar'),
      recorridoElement: element.querySelector('.hud__recorrido'),
    }
  }

  init() {
    if (this.overlayElement) return

    const { element, ...partes } = this.createElement()
    Object.assign(this, partes)
    this.overlayElement = element
    this.overlayElement.style.opacity = '0'

    this.entrarElement.addEventListener('click', () => {
      document.dispatchEvent(
        new CustomEvent('mesa:abrir', { detail: { index: this.activePlaneIndex } })
      )
    })

    document.body.append(this.overlayElement)
  }

  getTargetPlaneIndex(cameraZ) {
    const blendData = this.gallery.getPlaneBlendData(cameraZ)
    if (!blendData) return -1
    return blendData.blend >= 0.5 ? blendData.nextPlaneIndex : blendData.currentPlaneIndex
  }

  applyPlaneContent(planeIndex) {
    const plane = this.gallery.planes[planeIndex]
    if (!plane || this.activePlaneIndex === planeIndex) return

    const { word, pms, color } = plane.userData.label || {}
    const cuantas = plane.userData.fotos?.length || 0
    const orden = String(planeIndex + 1).padStart(2, '0')

    this.numeroElement.textContent = orden
    this.nombreElement.textContent = word || 'mesa'
    this.horaElement.textContent = pms && pms !== 'N/A' ? pms : ''
    this.recorridoElement.textContent = `${orden} / ${String(this.gallery.planes.length).padStart(2, '0')}`
    this.conteoElement.textContent = cuantas ? `${cuantas} ${cuantas === 1 ? 'foto' : 'fotos'}` : ''
    this.entrarElement.hidden = cuantas === 0
    this.overlayElement.style.color = color || ''

    this.activePlaneIndex = planeIndex
  }

  resize() {}

  update(camera = null) {
    if (!camera || !this.overlayElement) return

    const targetPlaneIndex = this.getTargetPlaneIndex(camera.position.z)
    if (targetPlaneIndex < 0) {
      this.overlayElement.style.opacity = '0'
      return
    }

    this.applyPlaneContent(targetPlaneIndex)
    this.overlayElement.style.opacity = '1'
  }

  render() {}

  dispose() {
    this.overlayElement?.remove()
    this.overlayElement = null
    this.numeroElement = null
    this.nombreElement = null
    this.conteoElement = null
    this.horaElement = null
    this.entrarElement = null
    this.recorridoElement = null
    this.activePlaneIndex = -1
  }
}

export { Label }
