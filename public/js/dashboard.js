/**
 * ==============================================================================
 * CONTROLADOR DEL PANEL DE VENTAS (DASHBOARD)
 * ==============================================================================
 * Muestra el resumen comercial, métricas clave (KPIs), alertas de stock bajo,
 * filtrado avanzado por fechas/estado y acciones rápidas (duplicar, anular, PDF).
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const lista = document.getElementById('listaCotizaciones');
  const buscar = document.getElementById('buscar');
  const filtroEstado = document.getElementById('filtroEstado');
  const filtroDesde = document.getElementById('filtroDesde');
  const filtroHasta = document.getElementById('filtroHasta');
  const metricas = document.getElementById('metricasVentas');
  const alertasStock = document.getElementById('alertasStock');
  const contador = document.getElementById('contadorCotizaciones');

  // Estado local
  let cotizaciones = [];

  /**
   * Filtra y renderiza la lista de cotizaciones según los criterios actuales
   */
  function render() {
    const q = buscar.value.trim().toLowerCase();
    const estado = filtroEstado.value;
    const desde = filtroDesde.value;
    const hasta = filtroHasta.value;

    const filtradas = cotizaciones.filter((c) => {
      // Si no hay filtro de estado, omitir las anuladas por defecto
      if (!estado && c.estado === 'anulada') return false;
      if (estado && c.estado !== estado) return false;

      // Filtros de fecha
      if (desde && (c.creadoEn || '') < desde) return false;
      if (hasta && (c.creadoEn || '') > `${hasta}T23:59:59`) return false;

      // Búsqueda por texto (folio, cliente, empresa, teléfono)
      if (q) {
        const texto = [
          c.folio,
          c.destinatario?.nombre,
          c.destinatario?.empresa,
          c.destinatario?.telefono,
        ]
          .join(' ')
          .toLowerCase();

        if (!texto.includes(q)) return false;
      }

      return true;
    });

    if (!filtradas.length) {
      lista.innerHTML = `
        <div class="vacio" style="grid-column: 1 / -1">
          <h3 class="vacio__titulo">Sin resultados</h3>
          <p class="vacio__texto">No hay cotizaciones que coincidan con los filtros seleccionados.</p>
          <a class="btn btn--primario" href="/cotizacion.html">Crear primera cotización</a>
        </div>
      `;
      contador.textContent = '0 registros';
      return;
    }

    lista.innerHTML = filtradas
      .map((c) => {
        const folioLimpio = c.folio ? c.folio.replace(/[^\w\-]/g, '_') : '';
        const estadoActual = c.estado || 'borrador';

        return `
          <article class="card dashboard__card">
            <div class="dashboard__card-cabecera">
              <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                <span class="card__badge">${c.folio || 'Sin folio'}</span>
                ${
                  c.duplicadaDeFolio
                    ? `<span class="card__badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-weight:600;font-size:0.75rem;">📑 Copia de ${c.duplicadaDeFolio}</span>`
                    : ''
                }
              </div>
              <select class="dashboard__select-estado dashboard__estado--${estadoActual}" data-cambiar-estado="${c.id}" title="Cambiar estado rápidamente">
                <option value="borrador" ${estadoActual === 'borrador' ? 'selected' : ''}>Borrador</option>
                <option value="enviada" ${estadoActual === 'enviada' ? 'selected' : ''}>Enviada</option>
                <option value="aprobada" ${estadoActual === 'aprobada' ? 'selected' : ''}>Aprobada</option>
                <option value="rechazada" ${estadoActual === 'rechazada' ? 'selected' : ''}>Rechazada</option>
                <option value="anulada" ${estadoActual === 'anulada' ? 'selected' : ''}>Anulada</option>
              </select>
            </div>

            <h3 class="card__titulo">${c.destinatario?.nombre || 'Sin destinatario'}</h3>
            <p class="card__meta">${c.destinatario?.empresa || 'Sin empresa / obra'}</p>
            <p class="card__dato"><strong>Fecha:</strong> ${UI.formatDate(c.creadoEn)}</p>
            <p class="card__dato"><strong>Teléfono:</strong> ${c.destinatario?.telefono || '—'}</p>
            <p class="card__dato"><strong>Items:</strong> ${(c.items || []).length}</p>
            <p class="card__dato"><strong>Total:</strong> ${UI.money(c.total)}</p>

            <div class="card__acciones">
              <a class="btn btn--primario btn--pequeño" href="/cotizacion.html?id=${c.id}">
                Ver / Editar
              </a>
              <a class="btn btn--secundario btn--pequeño" href="/cotizacion.html?id=${c.id}&reimprimir=1">
                Reimprimir
              </a>
              ${
                folioLimpio
                  ? `<a class="btn btn--secundario btn--pequeño" href="/pdf/${folioLimpio}.pdf" target="_blank">PDF</a>`
                  : ''
              }
              <button class="btn btn--secundario btn--pequeño" type="button" data-duplicar="${c.id}">
                Duplicar
              </button>
              ${
                estadoActual !== 'anulada'
                  ? `<button class="btn btn--peligro btn--pequeño" type="button" data-eliminar="${c.id}">Anular</button>`
                  : ''
              }
            </div>
          </article>
        `;
      })
      .join('');

    contador.textContent = `${filtradas.length} registro${filtradas.length === 1 ? '' : 's'}`;
  }

  /**
   * Calcula y renderiza las tarjetas de resumen financiero (KPIs)
   */
  function renderMetricas() {
    const activas = cotizaciones.filter((c) => c.estado !== 'anulada');
    const aprobadas = cotizaciones.filter((c) => c.estado === 'aprobada');
    const totalAprobadas = aprobadas.reduce((s, c) => s + (Number(c.total) || 0), 0);
    const pendientes = cotizaciones.filter((c) => c.estado === 'enviada');

    const kpis = [
      { icono: '▧', titulo: 'Cotizaciones', valor: activas.length, detalle: 'activas' },
      { icono: '$', titulo: 'Ventas aprobadas', valor: UI.money(totalAprobadas), detalle: `${aprobadas.length} aprobadas` },
      { icono: '◷', titulo: 'Pendientes', valor: pendientes.length, detalle: 'por confirmar' },
    ];

    metricas.innerHTML = kpis
      .map(
        (k) => `
        <article class="venta-kpi">
          <span class="venta-kpi__icono">${k.icono}</span>
          <div>
            <small>${k.titulo}</small>
            <strong>${k.valor}</strong>
            <span>${k.detalle}</span>
          </div>
        </article>
      `
      )
      .join('');
  }

  /**
   * Consulta y muestra productos que se encuentren en o por debajo del stock mínimo
   */
  async function cargarAlertas() {
    try {
      const alertas = await Api.getAlertasInventario();
      alertasStock.hidden = !alertas.length;

      if (alertas.length) {
        const items = alertas
          .map((a) => `${a.nombre} (${a.stockActual}/${a.stockMinimo} ${a.unidad})`)
          .join(' · ');
        alertasStock.innerHTML = `<strong>⚠ Alerta de Stock bajo:</strong> ${items}`;
      } else {
        alertasStock.innerHTML = '';
      }
    } catch {
      alertasStock.hidden = true;
    }
  }

  /**
   * Carga los datos maestros desde la API
   */
  async function cargar() {
    try {
      cotizaciones = await Api.getCotizaciones();
      renderMetricas();
      render();
      await cargarAlertas();
    } catch (err) {
      UI.showMessage('error', `Error al cargar cotizaciones: ${err.message}`);
    }
  }

  // Eventos de filtrado
  buscar.addEventListener('input', render);
  filtroEstado.addEventListener('change', render);
  filtroDesde.addEventListener('change', render);
  filtroHasta.addEventListener('change', render);

  // Delegación de eventos en las tarjetas de la lista
  lista.addEventListener('click', async (e) => {
    // Acción: Duplicar cotización
    const btnDuplicar = e.target.closest('[data-duplicar]');
    if (btnDuplicar) {
      const id = btnDuplicar.getAttribute('data-duplicar');
      try {
        btnDuplicar.disabled = true;
        const copia = await Api.duplicarCotizacion(id);
        // Redireccionar de inmediato al formulario de edición
        window.location.href = `/cotizacion.html?id=${copia.id}&duplicada=1`;
      } catch (err) {
        UI.showMessage('error', err.message);
        btnDuplicar.disabled = false;
      }
      return;
    }

    // Acción: Anulación lógica
    const btnEliminar = e.target.closest('[data-eliminar]');
    if (btnEliminar) {
      const id = btnEliminar.getAttribute('data-eliminar');
      const confirmar = confirm(
        '¿Desea anular esta cotización? Quedará archivada y protegida sin eliminarse permanentemente.'
      );
      if (!confirmar) return;

      try {
        await Api.eliminarCotizacion(id);
        UI.showMessage('exito', 'Cotización marcada como anulada.');
        await cargar();
      } catch (err) {
        UI.showMessage('error', err.message);
      }
    }
  });

  // Cambio directo de estado desde la tarjeta del dashboard sin imprimir
  lista.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-cambiar-estado]')) return;
    const id = e.target.getAttribute('data-cambiar-estado');
    const nuevoEstado = e.target.value;
    const select = e.target;

    try {
      select.disabled = true;
      const cotizacion = cotizaciones.find((c) => c.id === id);
      await Api.actualizarCotizacion(id, { estado: nuevoEstado });
      if (cotizacion) cotizacion.estado = nuevoEstado;

      // Actualizar clases de color
      select.className = `dashboard__select-estado dashboard__estado--${nuevoEstado}`;
      renderMetricas();
      UI.showMessage(
        'exito',
        `Estado de cotización ${cotizacion?.folio || ''} actualizado a "${nuevoEstado.toUpperCase()}".`
      );
    } catch (err) {
      UI.showMessage('error', `Error al cambiar estado: ${err.message}`);
      await cargar();
    } finally {
      select.disabled = false;
    }
  });

  // Inicialización
  cargar();
});
