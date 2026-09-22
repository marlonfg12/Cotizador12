/**
 * ==============================================================================
 * UTILIDADES DE INTERFAZ DE USUARIO (UI HELPERS)
 * ==============================================================================
 * Funciones reutilizables para formato de moneda (es-CO), fechas localizadas,
 * visualización de banners flash y control de modales y menú responsivo.
 * ==============================================================================
 */

const UI = {
  /**
   * Formatea un número como moneda colombiana ($X.XXX sin decimales)
   * @param {number|string} value
   * @returns {string} Valor formateado
   */
  money(value) {
    const num = Number(value) || 0;
    return (
      '$' +
      num.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
    );
  },

  /**
   * Formatea una fecha ISO a formato corto en español
   * @param {string} iso
   * @returns {string} Fecha formateada
   */
  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  },

  /**
   * Muestra un banner flash de notificación en la parte superior
   * @param {'exito'|'error'|'info'} type - Clase semántica de alerta
   * @param {string} text - Mensaje visible
   */
  showMessage(type, text) {
    const el = document.getElementById('mensaje');
    if (!el) return;
    el.hidden = false;
    el.className = `alerta alerta--${type}`;
    el.textContent = text;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * Limpia y oculta cualquier notificación flash visible
   */
  clearMessage() {
    const el = document.getElementById('mensaje');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  },

  /**
   * Inicializa el toggle del menú lateral para pantallas móviles
   */
  initMenu() {
    const btn = document.getElementById('btnMenu');
    const sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;

    btn.addEventListener('click', () => {
      sidebar.classList.toggle('is-oculto-movil');
    });

    if (window.matchMedia('(max-width: 899px)').matches) {
      sidebar.classList.add('is-oculto-movil');
    }
  },

  /**
   * Abre un modal por su ID
   * @param {string} id
   */
  openModal(id = 'modal') {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('is-abierto');
  },

  /**
   * Cierra un modal por su ID
   * @param {string} id
   */
  closeModal(id = 'modal') {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('is-abierto');
  },
};

document.addEventListener('DOMContentLoaded', () => {
  UI.initMenu();
});
