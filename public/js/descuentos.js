/**
 * ==============================================================================
 * CONTROLADOR DE REGLAS DE DESCUENTO
 * ==============================================================================
 * Permite definir matrices de descuento automático por cliente (se aplica al
 * subtotal acumulado) o por producto (se precarga en la línea de cotización).
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos del DOM
  const tipoSelect = document.getElementById('tipo');
  const refSelect = document.getElementById('referencia');
  const porcentajeInput = document.getElementById('porcentaje');
  const listaContenedor = document.getElementById('lista');
  const formDescuento = document.getElementById('formDescuento');

  // Estado local
  let clientes = [];
  let productos = [];
  let descuentos = [];

  /**
   * Actualiza el select de referencias según el tipo seleccionado (cliente o producto)
   */
  const cargarReferencias = () => {
    const datos = tipoSelect.value === 'cliente' ? clientes : productos;

    if (!datos.length) {
      refSelect.innerHTML = '<option value="">No hay registros disponibles</option>';
      return;
    }

    refSelect.innerHTML = datos
      .map(
        (item) =>
          `<option value="${item.id}">${item.nombre}${item.empresa ? ` — ${item.empresa}` : ''}</option>`
      )
      .join('');
  };

  /**
   * Renderiza las tarjetas de descuentos configurados
   */
  const render = () => {
    if (!descuentos.length) {
      listaContenedor.innerHTML =
        '<div class="vacio" style="grid-column: 1 / -1">No hay descuentos configurados.</div>';
      return;
    }

    listaContenedor.innerHTML = descuentos
      .map((d) => {
        const coleccion = d.tipo === 'cliente' ? clientes : productos;
        const item = coleccion.find((i) => i.id === d.referenciaId);
        const nombreReferencia = item
          ? item.nombre + (item.empresa ? ` (${item.empresa})` : '')
          : 'Registro eliminado';

        return `
          <article class="card">
            <span class="card__badge">${d.tipo === 'cliente' ? 'Cliente' : 'Producto'}</span>
            <h3 class="card__titulo">${nombreReferencia}</h3>
            <p class="card__dato"><strong>${d.porcentaje}%</strong> de descuento automático</p>
            <div class="card__acciones">
              <button class="btn btn--peligro btn--pequeño" type="button" data-id="${d.id}">
                Quitar
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  };

  // Carga de colecciones
  try {
    [clientes, productos, descuentos] = await Promise.all([
      Api.getClientes(),
      Api.getProductos(),
      Api.getDescuentos(),
    ]);
    cargarReferencias();
    render();
  } catch (err) {
    UI.showMessage('error', `Error cargando datos de descuentos: ${err.message}`);
  }

  // Cambio de tipo de descuento
  tipoSelect.addEventListener('change', cargarReferencias);

  // Guardar regla de descuento
  formDescuento.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearMessage();

    const tipo = tipoSelect.value;
    const referenciaId = refSelect.value;
    const porcentaje = parseFloat(porcentajeInput.value);

    if (!referenciaId) {
      UI.showMessage('error', 'Seleccione un cliente o producto válido.');
      return;
    }

    if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      UI.showMessage('error', 'Ingrese un porcentaje válido entre 0 y 100.');
      return;
    }

    const indexExistente = descuentos.findIndex(
      (d) => d.tipo === tipo && d.referenciaId === referenciaId
    );

    if (indexExistente !== -1) {
      descuentos[indexExistente].porcentaje = porcentaje;
    } else {
      descuentos.push({
        tipo,
        referenciaId,
        porcentaje,
      });
    }

    try {
      descuentos = await Api.guardarDescuentos(descuentos);
      porcentajeInput.value = '';
      UI.showMessage('exito', 'Regla de descuento guardada exitosamente.');
      render();
    } catch (err) {
      UI.showMessage('error', err.message);
    }
  });

  // Eliminar regla de descuento
  listaContenedor.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;

    try {
      descuentos = await Api.guardarDescuentos(descuentos.filter((d) => d.id !== id));
      UI.showMessage('exito', 'Descuento eliminado.');
      render();
    } catch (err) {
      UI.showMessage('error', err.message);
    }
  });
});
