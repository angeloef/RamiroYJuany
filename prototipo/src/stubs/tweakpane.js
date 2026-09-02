// Reemplaza tweakpane en el build de produccion (ver vite.config.js): el panel de
// debug se abre con la tecla D en desarrollo y no tiene por que viajar al celular
// de los invitados. La API es la que usa Debug.js, y no hace nada.
const binding = { on() {} }
const folder = { addBinding: () => binding, addFolder: () => folder }

class Pane {
  constructor() {
    this.element = document.createElement('div')
  }
  addFolder() {
    return folder
  }
  addBinding() {
    return binding
  }
  dispose() {}
}

export { Pane }
