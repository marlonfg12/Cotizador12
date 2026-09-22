/**
 * ==============================================================================
 * CONTROLADOR DE PRODUCTOS E INVENTARIO
 * ==============================================================================
 * Gestiona el catálogo de materiales, precios unitarios, unidades de medida
 * y control de existencias con alertas visuales de stock mínimo.
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const lista = document.getElementById('lista');
  const buscar = document.getElementById('buscar');
  const form = document.getElementById('formProducto');
  const btnNuevo = document.getElementById('btnNuevo');
  const btnCerrarModal = document.getElementById('btnCerrarModal');
  const modalMsg = document.getElementById('modalMensajeProducto');

  // Estado local
  let productos = [];

  function mostrarModalError(texto) {
    if (modalMsg) {
      modalMsg.textContent = texto;
      modalMsg.hidden = false;
    }
  }

  function limpiarModalError() {
    if (modalMsg) {
      modalMsg.textContent = '';
      modalMsg.hidden = true;
    }
  }

  /**
   * Renderiza el catálogo de productos con búsqueda reactiva
   * @param {string} filtro - Texto de búsqueda
   */
  function render(filtro = '') {
    const q = filtro.trim().toLowerCase();
    const filtrados = productos.filter((p) =>
      [p.nombre, p.descripcion, p.unidad].join(' ').toLowerCase().includes(q)
    );

    if (!filtrados.length) {
      lista.innerHTML = `
        <div class="vacio" style="grid-column: 1 / -1">
          <h3 class="vacio__titulo">No hay productos guardados</h3>
          <p class="vacio__texto">Esto es opcional. En la cotización puede escribir materiales a mano.</p>
          <button class="btn btn--primario" type="button" id="btnVacioNuevo">Agregar producto</button>
        </div>
      `;
      document.getElementById('btnVacioNuevo')?.addEventListener('click', abrirNuevo);
      return;
    }

    lista.innerHTML = filtrados
      .map((p) => {
        const stockBajo = Number(p.stockActual) <= Number(p.stockMinimo);
        return `
          <article class="card">
            <h3 class="card__titulo">${p.nombre}</h3>
            <p class="card__meta">${p.descripcion || 'Sin descripción adicional'}</p>
            <p class="card__dato"><strong>Precio unitario:</strong> ${UI.money(p.precio)}</p>
            <p class="card__dato">
              <strong>Stock en bodega:</strong> ${p.stockActual ?? 0}
              ${stockBajo ? ' <span style="color:var(--color-peligro);font-weight:bold;">⚠ Stock Bajo</span>' : ''}
            </p>
            <div class="card__acciones">
              <button class="btn btn--secundario btn--pequeño" type="button" data-editar="${p.id}">Editar</button>
              <button class="btn btn--peligro btn--pequeño" type="button" data-eliminar="${p.id}">Eliminar</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  /**
   * Abre el modal para registrar un nuevo producto
   */
  function abrirNuevo() {
    limpiarModalError();
    form.reset();
    document.getElementById('productoId').value = '';
    document.getElementById('unidad').value = 'pza';
    document.getElementById('precio').value = '';
    document.getElementById('stockActual').value = '0';
    document.getElementById('stockMinimo').value = '0';
    document.getElementById('modalTitulo').textContent = 'Nuevo producto';
    UI.openModal();
    setTimeout(() => document.getElementById('nombre')?.focus(), 100);
  }

  /**
   * Abre el modal prellenado para editar un producto
   * @param {object} producto - Datos del producto
   */
  function abrirEditar(producto) {
    limpiarModalError();
    document.getElementById('productoId').value = producto.id;
    document.getElementById('nombre').value = producto.nombre || '';
    document.getElementById('descripcion').value = producto.descripcion || '';
    document.getElementById('unidad').value = producto.unidad || 'pza';
    document.getElementById('precio').value = producto.precio ?? '';
    document.getElementById('stockActual').value = producto.stockActual ?? 0;
    document.getElementById('stockMinimo').value = producto.stockMinimo ?? 0;
    document.getElementById('modalTitulo').textContent = 'Editar producto';
    UI.openModal();
    setTimeout(() => document.getElementById('nombre')?.focus(), 100);
  }

  /**
   * Carga los productos desde el backend
   */
  async function cargar() {
    try {
      productos = await Api.getProductos();
      render(buscar ? buscar.value : '');
    } catch (err) {
      UI.showMessage('error', `Error cargando productos: ${err.message}`);
    }
  }

  // Eventos de interfaz
  if (btnNuevo) btnNuevo.addEventListener('click', abrirNuevo);
  if (btnCerrarModal) btnCerrarModal.addEventListener('click', () => UI.closeModal());
  if (buscar) buscar.addEventListener('input', () => render(buscar.value));

  /**
   * Normaliza un texto para comparaciones insensibles a mayúsculas, tildes y espacios
   * @param {string} texto
   * @returns {string}
   */
  function normalizarTexto(texto) {
    if (!texto) return '';
    return String(texto)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  // Guardar producto (crear o actualizar)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarModalError();

    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('nombre').value.trim();

    if (!nombre) {
      mostrarModalError('El nombre del producto es obligatorio.');
      document.getElementById('nombre').focus();
      return;
    }

    const norm = normalizarTexto(nombre);
    const duplicado = productos.find((p) => p.id !== id && normalizarTexto(p.nombre) === norm);
    if (duplicado) {
      mostrarModalError(`Ya existe un producto registrado con el nombre "${duplicado.nombre}".`);
      document.getElementById('nombre').focus();
      return;
    }

    const precioRaw = document.getElementById('precio').value;
    const precio = Number(precioRaw);
    if (!precioRaw || isNaN(precio) || precio <= 0) {
      mostrarModalError('El precio unitario debe ser mayor a 0.');
      document.getElementById('precio').focus();
      return;
    }

    const stockActualRaw = document.getElementById('stockActual').value;
    const stockActual = Number(stockActualRaw);
    if (isNaN(stockActual) || stockActual < 0) {
      mostrarModalError('El stock actual no puede ser un valor negativo.');
      document.getElementById('stockActual').focus();
      return;
    }

    const stockMinimoRaw = document.getElementById('stockMinimo').value;
    const stockMinimo = Number(stockMinimoRaw);
    if (isNaN(stockMinimo) || stockMinimo < 0) {
      mostrarModalError('La alerta de stock mínimo no puede ser un valor negativo.');
      document.getElementById('stockMinimo').focus();
      return;
    }

    const payload = {
      nombre,
      descripcion: document.getElementById('descripcion').value.trim(),
      unidad: document.getElementById('unidad').value.trim() || 'pza',
      precio,
      stockActual,
      stockMinimo,
    };

    try {
      if (id) {
        await Api.actualizarProducto(id, payload);
      } else {
        await Api.crearProducto(payload);
      }

      UI.closeModal();
      UI.showMessage('exito', `Producto "${nombre}" guardado correctamente en el catálogo.`);
      await cargar();
    } catch (err) {
      mostrarModalError(err.message);
    }
  });

  // Delegación de acciones de editar y eliminar
  lista.addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar]');
    const eliminar = e.target.closest('[data-eliminar]');

    if (editar) {
      const producto = productos.find((p) => p.id === editar.getAttribute('data-editar'));
      if (producto) abrirEditar(producto);
    }

    if (eliminar) {
      if (!confirm('¿Desea eliminar este producto del catálogo?')) return;
      try {
        await Api.eliminarProducto(eliminar.getAttribute('data-eliminar'));
        UI.showMessage('exito', 'Producto eliminado.');
        await cargar();
      } catch (err) {
        UI.showMessage('error', err.message);
      }
    }
  });

  // Carga inicial
  cargar();
});
