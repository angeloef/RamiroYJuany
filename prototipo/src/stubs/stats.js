// Reemplaza el contador de FPS de three en produccion: corre begin()/end() en cada
// frame y escribe en el DOM, y en la web publica no se muestra nunca.
class Stats {
  constructor() {
    this.dom = document.createElement('div')
  }
  showPanel() {}
  begin() {}
  end() {}
}

export default Stats
