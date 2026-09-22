/**
 * ==============================================================================
 * CONTROLADOR DE CLIENTES
 * ==============================================================================
 * Gestiona el directorio maestro de clientes frecuentes para reutilización
 * automática de datos de contacto y facturación en las cotizaciones.
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const lista = document.getElementById('lista');
  const buscar = document.getElementById('buscar');
  const form = document.getElementById('formCliente');
  const btnNuevo = document.getElementById('btnNuevo');
  const btnCerrarModal = document.getElementById('btnCerrarModal');

  // Estado local
  let clientes = [];

  /**
   * Renderiza el directorio de clientes con filtrado en tiempo real
   * @param {string} filtro - Texto de búsqueda
   */
  function render(filtro = '') {
    const q = filtro.trim().toLowerCase();
    const filtrados = clientes.filter((c) =>
      [c.nombre, c.empresa, c.nit, c.telefono, c.email, c.direccion].join(' ').toLowerCase().includes(q)
    );

    if (!filtrados.length) {
      lista.innerHTML = `
        <div class="vacio" style="grid-column: 1 / -1">
          <h3 class="vacio__titulo">No hay clientes guardados</h3>
          <p class="vacio__texto">Esto es opcional. Puede crear cotizaciones sin registrar clientes previamente.</p>
          <button class="btn btn--primario" type="button" id="btnVacioNuevo">Agregar cliente</button>
        </div>
      `;
      document.getElementById('btnVacioNuevo')?.addEventListener('click', abrirNuevo);
      return;
    }

    lista.innerHTML = filtrados
      .map(
        (c) => {
          const tipoTexto = c.tipoCliente === 'empresa' ? 'Empresa' : (c.tipoCliente === 'otros' ? 'Otros' : 'Persona Natural');
          return `
          <article class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;margin-bottom:0.25rem;">
              <h3 class="card__titulo" style="margin:0;">${c.nombre}</h3>
              <span class="card__badge">${tipoTexto}</span>
            </div>
            <p class="card__meta">${c.empresa || 'Sin empresa / obra'}</p>
            <p class="card__dato"><strong>NIT / Cédula:</strong> ${c.nit || '—'}</p>
            <p class="card__dato"><strong>Teléfono:</strong> ${c.telefono || '—'}</p>
            <p class="card__dato"><strong>Email:</strong> ${c.email || '—'}</p>
            <p class="card__dato"><strong>Dirección:</strong> ${c.direccion || '—'}</p>
            <div class="card__acciones">
              <button class="btn btn--secundario btn--pequeño" type="button" data-editar="${c.id}">
                Editar
              </button>
              <button class="btn btn--peligro btn--pequeño" type="button" data-eliminar="${c.id}">
                Eliminar
              </button>
            </div>
          </article>
        `;
        }
      )
      .join('');
  }

  /**
   * Abre el modal para crear un nuevo cliente
   */
  function abrirNuevo() {
    form.reset();
    document.getElementById('clienteId').value = '';
    document.getElementById('nit').value = '';
    document.getElementById('tipoCliente').value = 'persona';
    document.getElementById('modalTitulo').textContent = 'Nuevo cliente';
    UI.openModal();
  }

  /**
   * Abre el modal prellenado para editar un cliente existente
   * @param {object} cliente - Datos del cliente
   */
  function abrirEditar(cliente) {
    document.getElementById('clienteId').value = cliente.id;
    document.getElementById('nombre').value = cliente.nombre || '';
    document.getElementById('empresa').value = cliente.empresa || '';
    document.getElementById('nit').value = cliente.nit || '';
    document.getElementById('tipoCliente').value = cliente.tipoCliente || 'persona';
    document.getElementById('telefono').value = cliente.telefono || '';
    document.getElementById('email').value = cliente.email || '';
    document.getElementById('direccion').value = cliente.direccion || '';
    document.getElementById('modalTitulo').textContent = 'Editar cliente';
    UI.openModal();
  }

  /**
   * Carga los clientes desde la API
   */
  async function cargar() {
    try {
      clientes = await Api.getClientes();
      render(buscar.value);
    } catch (err) {
      UI.showMessage('error', `Error cargando clientes: ${err.message}`);
    }
  }

  // Eventos de interfaz
  btnNuevo.addEventListener('click', abrirNuevo);
  btnCerrarModal.addEventListener('click', () => UI.closeModal());
  buscar.addEventListener('input', () => render(buscar.value));

  /**
   * Normaliza cadenas para comparación insensible a mayúsculas, acentos y espacios múltiples
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

  /**
   * Normaliza números de identificación (NIT/Cédula) eliminando puntos, guiones y espacios
   * @param {string} doc
   * @returns {string}
   */
  function normalizarDoc(doc) {
    if (!doc) return '';
    return String(doc).replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
  }

  // Guardar cliente
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('clienteId').value;
    const nombre = document.getElementById('nombre').value.trim();
    const nit = document.getElementById('nit').value.trim();

    if (!nombre) {
      UI.showMessage('error', 'El nombre del cliente es obligatorio.');
      document.getElementById('nombre').focus();
      return;
    }

    const normNombre = normalizarTexto(nombre);
    const duplicadoNombre = clientes.find((c) => c.id !== id && normalizarTexto(c.nombre) === normNombre);
    if (duplicadoNombre) {
      UI.showMessage(
        'error',
        `Ya existe un cliente registrado con el nombre "${duplicadoNombre.nombre}". No se permiten clientes duplicados.`
      );
      document.getElementById('nombre').focus();
      return;
    }

    if (nit) {
      const normNit = normalizarDoc(nit);
      if (normNit) {
        const duplicadoNit = clientes.find((c) => c.id !== id && c.nit && normalizarDoc(c.nit) === normNit);
        if (duplicadoNit) {
          UI.showMessage(
            'error',
            `Ya existe un cliente registrado con el NIT/Cédula "${duplicadoNit.nit}" (${duplicadoNit.nombre}).`
          );
          document.getElementById('nit').focus();
          return;
        }
      }
    }

    const payload = {
      nombre,
      empresa: document.getElementById('empresa').value.trim(),
      nit,
      tipoCliente: document.getElementById('tipoCliente').value || 'persona',
      telefono: document.getElementById('telefono').value.trim(),
      email: document.getElementById('email').value.trim(),
      direccion: document.getElementById('direccion').value.trim(),
    };

    try {
      if (id) {
        await Api.actualizarCliente(id, payload);
      } else {
        await Api.crearCliente(payload);
      }

      UI.closeModal();
      UI.showMessage('exito', 'Cliente guardado correctamente.');
      await cargar();
    } catch (err) {
      UI.showMessage('error', err.message);
    }
  });

  // Delegación de acciones de editar y eliminar
  lista.addEventListener('click', async (e) => {
    const editar = e.target.closest('[data-editar]');
    const eliminar = e.target.closest('[data-eliminar]');

    if (editar) {
      const cliente = clientes.find((c) => c.id === editar.getAttribute('data-editar'));
      if (cliente) abrirEditar(cliente);
    }

    if (eliminar) {
      if (!confirm('¿Desea eliminar este cliente del directorio?')) return;
      try {
        await Api.eliminarCliente(eliminar.getAttribute('data-eliminar'));
        UI.showMessage('exito', 'Cliente eliminado.');
        await cargar();
      } catch (err) {
        UI.showMessage('error', err.message);
      }
    }
  });

  // Carga inicial
  cargar();
});
