/**
 * ==============================================================================
 * CONTROLADOR PRINCIPAL DEL FORMULARIO DE COTIZACIÓN
 * ==============================================================================
 * Maneja la creación, edición, cálculo reactivo de impuestos (IVA, Retefuente, ReteICA),
 * desglose del 50% (anticipo y saldo), generación vectorial de PDF con jsPDF,
 * impresión y despacho omnicanal (WhatsApp con código 57 y Correo SMTP).
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Parámetros de la URL
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('id');
  const reimprimir = params.get('reimprimir') === '1';

  // Referencias a elementos del DOM
  const form = document.getElementById('formCotizacion');
  const itemsBody = document.getElementById('itemsBody');
  const clienteSelect = document.getElementById('clienteExistente');
  const btnAgregarItem = document.getElementById('btnAgregarItem');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnImprimir = document.getElementById('btnImprimir');
  const btnImprimirAbajo = document.getElementById('btnImprimirAbajo');
  const btnVerPdf = document.getElementById('btnVerPdf');
  const btnGuardarSoloEstado = document.getElementById('btnGuardarSoloEstado');
  const btnWhatsApp = document.getElementById('btnWhatsApp');
  const btnCorreo = document.getElementById('btnCorreo');
  const tituloPagina = document.getElementById('tituloPagina');

  // Controles de entrega y guardado rápido
  const inputEntregaDesde = document.getElementById('entregaDesde');
  const inputEntregaHasta = document.getElementById('entregaHasta');
  const inputTiempoEntrega = document.getElementById('tiempoEntrega');
  const btnGuardarClienteManual = document.getElementById('btnGuardarClienteManual');

  // Controles de impuestos
  const ivaInput = document.getElementById('ivaPorcentaje');
  const checkIVA = document.getElementById('aplicarIVA');
  const retefuenteInput = document.getElementById('retefuentePorcentaje');
  const checkRetefuente = document.getElementById('aplicarReteFuente');
  const reteicaInput = document.getElementById('reteicaPorcentaje');
  const checkReteICA = document.getElementById('aplicarReteICA');

  // Estado local
  let productos = [];
  let clientes = [];
  let descuentos = [];
  let configuracion = null;
  let cotizacionActual = null;

  // ----------------------------------------------------------------------------
  // 1. GESTIÓN DE LA TABLA DINÁMICA DE ÍTEMS
  // ----------------------------------------------------------------------------

  /**
   * Crea y añade una fila a la tabla de productos
   * @param {object} item - Datos iniciales de la línea
   */
  function crearFilaItem(item = {}) {
    const tr = document.createElement('tr');
    tr.className = 'items__fila';

    // Determina si inicia en modo catálogo o en modo manual
    const esModoCatalogo = Boolean(item.productoId);

    const opcionesProductos = productos
      .map(
        (p) =>
          `<option value="${p.id}" ${item.productoId === p.id ? 'selected' : ''}>${p.nombre}${p.descripcion ? ` — ${p.descripcion}` : ''}</option>`
      )
      .join('');

    tr.innerHTML = `
      <td>
        <div class="item-selector-grupo">
          <div class="item-selector-campo">
            <input class="formulario__campo item-descripcion" 
                   style="${esModoCatalogo ? 'display:none;' : ''}" 
                   placeholder="Escribir material (ej. Fleje de 30*30, Varilla 1/2...)" 
                   value="${item.descripcion || ''}" 
                   ${esModoCatalogo ? '' : 'required'} />
            <select class="formulario__select item-producto" 
                    style="${esModoCatalogo ? '' : 'display:none;'}">
              <option value="">— Elegir del catálogo —</option>
              ${opcionesProductos}
            </select>
          </div>
          <button class="btn btn--secundario btn-toggle-modo" type="button" 
                  title="${esModoCatalogo ? 'Cambiar a escribir manualmente' : 'Elegir producto del catálogo'}">
            ${esModoCatalogo ? '✏️ Manual' : '📦 Catálogo'}
          </button>
          <button class="btn btn--secundario btn-guardar-producto" type="button" 
                  title="Guardar este material en el catálogo de productos"
                  style="${esModoCatalogo ? 'display:none;' : ''}">
            💾 Guardar
          </button>
        </div>
      </td>
      <td>
        <input class="formulario__campo item-cantidad" type="number" min="0" step="0.01" 
               value="${item.cantidad ?? 1}" />
      </td>
      <td>
        <input class="formulario__campo item-precio" type="number" min="0" step="0.01" 
               value="${item.precioUnitario ?? 0}" />
      </td>
      <td>
        <input class="formulario__campo item-descuento" type="number" min="0" max="100" step="0.01" 
               value="${item.descuentoPorcentaje ?? 0}" />
      </td>
      <td class="items__quitar" style="text-align:center;">
        <button class="btn btn--peligro btn--pequeño btn-quitar" type="button" title="Quitar producto">Quitar</button>
      </td>
    `;

    itemsBody.appendChild(tr);
  }

  /**
   * Extrae los datos de todas las filas de productos de la tabla
   * @returns {Array<object>} Arreglo de ítems sanitizados
   */
  function leerItems() {
    const filas = itemsBody.querySelectorAll('.items__fila');
    return Array.from(filas).map((tr) => {
      const selectProd = tr.querySelector('.item-producto');
      const inputDesc = tr.querySelector('.item-descripcion');
      const enCatalogo = selectProd && selectProd.style.display !== 'none';

      let productoId = null;
      let descripcion = '';

      if (enCatalogo && selectProd.value) {
        productoId = selectProd.value;
        const producto = productos.find((p) => p.id === productoId);
        descripcion = producto
          ? producto.nombre + (producto.descripcion ? ` — ${producto.descripcion}` : '')
          : (inputDesc?.value.trim() || '');
      } else {
        productoId = null;
        descripcion = inputDesc?.value.trim() || '';
      }

      return {
        productoId,
        descripcion,
        cantidad: Math.max(0, Number(tr.querySelector('.item-cantidad')?.value) || 0),
        unidad: 'pza',
        precioUnitario: Math.max(0, Number(tr.querySelector('.item-precio')?.value) || 0),
        descuentoPorcentaje: Math.max(
          0,
          Math.min(100, Number(tr.querySelector('.item-descuento')?.value) || 0)
        ),
      };
    });
  }

  // ----------------------------------------------------------------------------
  // 2. MOTOR DE CÁLCULO FINANCIERO E IMPUESTOS
  // ----------------------------------------------------------------------------

  /**
   * Recalcula subtotales, descuentos, IVA, Retefuente, ReteICA, total y anticipos
   * @returns {object} Resumen financiero consolidado
   */
  function calcularTotales() {
    const items = leerItems();

    // 1. Subtotal de productos con descuento por ítem
    const subtotalProductos = items.reduce((acc, item) => {
      const factorDescuento = 1 - item.descuentoPorcentaje / 100;
      return acc + item.cantidad * item.precioUnitario * factorDescuento;
    }, 0);

    // 2. Descuento general del cliente
    const clienteId = clienteSelect ? clienteSelect.value : '';
    const reglaCliente = descuentos.find((d) => d.tipo === 'cliente' && d.referenciaId === clienteId);
    const descuentoClientePorcentaje = Number(reglaCliente?.porcentaje) || 0;
    const descuentoCliente = (subtotalProductos * descuentoClientePorcentaje) / 100;

    // 3. Subtotal neto (base imponible)
    const subtotal = Math.max(0, subtotalProductos - descuentoCliente);

    // 4. Impuesto al Valor Agregado (IVA)
    const aplicarIVA = checkIVA ? checkIVA.checked : true;
    const ivaPorcentaje = (aplicarIVA && ivaInput) ? Math.max(0, Number(ivaInput.value) || 0) : 0;
    const iva = (subtotal * ivaPorcentaje) / 100;

    // 5. Retención en la fuente (Retefuente)
    const aplicarReteFuente = checkRetefuente ? checkRetefuente.checked : true;
    const retefuentePorcentaje = (aplicarReteFuente && retefuenteInput)
      ? Math.max(0, Number(retefuenteInput.value) || 0)
      : 0;
    const retefuente = (subtotal * retefuentePorcentaje) / 100;

    // 6. Retención de Industria y Comercio (ReteICA)
    const aplicarReteICA = checkReteICA ? checkReteICA.checked : false;
    const reteicaPorcentaje = (aplicarReteICA && reteicaInput)
      ? Math.max(0, Number(reteicaInput.value) || 0)
      : 0;
    const reteica = (subtotal * reteicaPorcentaje) / 100;

    // 7. Total después de impuestos
    const total = Math.max(0, subtotal + iva - retefuente - reteica);

    // 8. Anticipo y saldo (50% institucional)
    const anticipo = total * 0.5;
    const saldo = total * 0.5;

    // Actualización visual en el DOM
    const subtotalEl = document.getElementById('subtotalTexto');
    const ivaEl = document.getElementById('ivaTexto');
    const retefuenteEl = document.getElementById('retefuenteTexto');
    const reteicaEl = document.getElementById('reteicaTexto');
    const anticipoEl = document.getElementById('anticipoTexto');
    const saldoEl = document.getElementById('saldoTexto');
    const totalEl = document.getElementById('totalTexto');

    if (subtotalEl) subtotalEl.textContent = UI.money(subtotal);
    if (ivaEl) ivaEl.textContent = UI.money(iva);
    if (retefuenteEl) retefuenteEl.textContent = UI.money(retefuente);
    if (reteicaEl) reteicaEl.textContent = UI.money(reteica);
    if (anticipoEl) anticipoEl.textContent = UI.money(anticipo);
    if (saldoEl) saldoEl.textContent = UI.money(saldo);
    if (totalEl) totalEl.textContent = UI.money(total);

    // Estilos para filas desactivadas
    const filaIva = document.getElementById('filaIva');
    if (filaIva) {
      filaIva.classList.toggle('totales__fila--desactivada', !aplicarIVA);
    }
    const filaRetefuente = document.getElementById('filaRetefuente');
    if (filaRetefuente) {
      filaRetefuente.classList.toggle('totales__fila--desactivada', !aplicarReteFuente);
    }
    const filaReteica = document.getElementById('filaReteica');
    if (filaReteica) {
      filaReteica.classList.toggle('totales__fila--desactivada', !aplicarReteICA);
    }

    // Actualizar resumen visual de condiciones del 50%
    const condicionAnticipo = document.getElementById('condicionAnticipoValor');
    const condicionSaldo = document.getElementById('condicionSaldoValor');
    const inputCondiciones = document.getElementById('condiciones');

    if (condicionAnticipo) condicionAnticipo.textContent = UI.money(anticipo);
    if (condicionSaldo) condicionSaldo.textContent = UI.money(saldo);
    if (inputCondiciones && (!inputCondiciones.value || inputCondiciones.value.startsWith('• Anticipo'))) {
      inputCondiciones.value = `• Anticipo del 50% (${UI.money(anticipo)}): Para iniciar fabricación / preparación\n• Saldo del 50% (${UI.money(saldo)}): Contra entrega del material`;
    }

    return {
      subtotal,
      ivaPorcentaje,
      aplicarIVA,
      iva,
      retefuentePorcentaje,
      aplicarReteFuente,
      retefuente,
      reteicaPorcentaje,
      aplicarReteICA,
      reteica,
      totalDespuesImpuestos: total,
      anticipo,
      saldo,
      total,
      items,
      descuentoClientePorcentaje,
      descuentoCliente,
    };
  }

  /**
   * Construye el objeto completo listo para enviar a la API
   * @returns {object} Payload de la cotización
   */
  function construirPayload() {
    const totales = calcularTotales();

    return {
      destinatario: {
        nombre: (document.getElementById('destinatarioNombre')?.value || '').trim(),
        empresa: (document.getElementById('destinatarioEmpresa')?.value || '').trim(),
        telefono: (document.getElementById('destinatarioTelefono')?.value || '').trim(),
        email: (document.getElementById('destinatarioEmail')?.value || '').trim(),
        direccion: (document.getElementById('destinatarioDireccion')?.value || '').trim(),
        nit: (document.getElementById('destinatarioNIT')?.value || '').trim(),
        tipoCliente: document.getElementById('destinatarioTipoCliente')?.value || 'persona',
        clienteId: clienteSelect?.value || null,
      },
      items: totales.items,
      subtotal: totales.subtotal,
      descuentoClientePorcentaje: totales.descuentoClientePorcentaje,
      descuentoCliente: totales.descuentoCliente,
      ivaPorcentaje: totales.ivaPorcentaje,
      aplicarIVA: totales.aplicarIVA,
      iva: totales.iva,
      retefuentePorcentaje: totales.retefuentePorcentaje,
      aplicarReteFuente: totales.aplicarReteFuente,
      retefuente: totales.retefuente,
      reteicaPorcentaje: totales.reteicaPorcentaje,
      aplicarReteICA: totales.aplicarReteICA,
      reteica: totales.reteica,
      totalDespuesImpuestos: totales.totalDespuesImpuestos,
      anticipo: totales.anticipo,
      saldo: totales.saldo,
      total: totales.total,
      estado: document.getElementById('estado')?.value || 'borrador',
      vigenteHasta: document.getElementById('vigenteHasta')?.value || '',
      servicio: (document.getElementById('servicio')?.value || '').trim(),
      detalleServicio: (document.getElementById('detalleServicio')?.value || '').trim(),
      condiciones: (document.getElementById('condiciones')?.value || '').trim(),
      metodosPago: (document.getElementById('metodosPago')?.value || '').trim(),
      entregaDesde: inputEntregaDesde?.value || '',
      entregaHasta: inputEntregaHasta?.value || '',
      tiempoEntrega: (inputTiempoEntrega?.value || document.getElementById('tiempoEntrega')?.value || '').trim() || '2 a 5 días hábiles',
      inicioProyecto: (document.getElementById('inicioProyecto')?.value || '').trim(),
      notas: (document.getElementById('notas')?.value || '').trim(),
    };
  }

  // ----------------------------------------------------------------------------
  // 3. CARGA Y POBLADO DE FORMULARIOS
  // ----------------------------------------------------------------------------

  /**
   * Rellena el select de clientes guardados
   */
  function cargarClientesSelect() {
    if (!clienteSelect) return;
    const valorSeleccionado = clienteSelect.value;
    clienteSelect.innerHTML = '<option value="">Escribir datos manualmente</option>';
    clientes.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.nombre}${c.empresa ? ` — ${c.empresa}` : ''}`;
      if (c.id === valorSeleccionado) {
        opt.selected = true;
      }
      clienteSelect.appendChild(opt);
    });
  }

  /**
   * Llena el formulario completo a partir de una cotización existente
   * @param {object} c - Objeto cotización
   */
  function llenarFormulario(c) {
    if (!c) return;
    cotizacionActual = c;
    const esDuplicada = Boolean(c.duplicadaDeFolio);
    const badgeDuplicada = esDuplicada
      ? ` <span class="card__badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-size:0.85rem;padding:0.25rem 0.65rem;border-radius:20px;font-weight:600;margin-left:0.5rem;vertical-align:middle;display:inline-flex;align-items:center;gap:0.3rem;">📑 Copia de ${c.duplicadaDeFolio}</span>`
      : '';

    if (tituloPagina) {
      tituloPagina.innerHTML = `Editar cotización ${c.folio || ''}${badgeDuplicada}`;
    }
    const folioLimpio = c.folio ? c.folio.replace(/[^\w\-]/g, '_') : '';
    if (btnVerPdf && folioLimpio) {
      btnVerPdf.href = `/pdf/${folioLimpio}.pdf`;
      btnVerPdf.hidden = false;
    }
    if (btnWhatsApp) btnWhatsApp.hidden = false;
    if (btnCorreo) btnCorreo.hidden = false;
    if (btnGuardar) btnGuardar.textContent = '💾 Guardar cotización';

    if (params.get('duplicada') === '1' || esDuplicada) {
      UI.showMessage(
        'info',
        `📑 Cotización duplicada exitosamente con el nuevo folio ${c.folio} (copia a partir de ${c.duplicadaDeFolio || 'la cotización anterior'}). Ya puedes modificar todos los datos necesarios y guardar.`
      );
    }

    const d = c.destinatario || {};
    if (document.getElementById('destinatarioNombre')) document.getElementById('destinatarioNombre').value = d.nombre || '';
    if (document.getElementById('destinatarioEmpresa')) document.getElementById('destinatarioEmpresa').value = d.empresa || '';
    if (document.getElementById('destinatarioTelefono')) document.getElementById('destinatarioTelefono').value = d.telefono || '';
    if (document.getElementById('destinatarioEmail')) document.getElementById('destinatarioEmail').value = d.email || '';
    if (document.getElementById('destinatarioDireccion')) document.getElementById('destinatarioDireccion').value = d.direccion || '';
    if (document.getElementById('destinatarioNIT')) document.getElementById('destinatarioNIT').value = d.nit || '';
    if (document.getElementById('destinatarioTipoCliente')) document.getElementById('destinatarioTipoCliente').value = d.tipoCliente || 'persona';

    if (clienteSelect && d.clienteId) {
      clienteSelect.value = d.clienteId;
    }

    if (document.getElementById('servicio')) {
      document.getElementById('servicio').value = c.servicio || 'Venta de Material de Construcción / Ornamentación';
    }
    if (document.getElementById('detalleServicio')) {
      document.getElementById('detalleServicio').value = c.detalleServicio || '';
    }
    if (document.getElementById('metodosPago')) {
      document.getElementById('metodosPago').value = c.metodosPago || 'Transferencia bancaria\nCuenta No.123 4567 8901';
    }

    if (inputTiempoEntrega) {
      inputTiempoEntrega.value = c.tiempoEntrega || '2 a 5 días hábiles';
    }
    if (inputEntregaDesde) {
      inputEntregaDesde.value = c.entregaDesde || '';
    }
    if (inputEntregaHasta) {
      inputEntregaHasta.value = c.entregaHasta || '';
    }
    if (!c.entregaDesde || !c.entregaHasta) {
      inicializarCalendarioEntrega(c.creadoEn || new Date());
    }

    if (document.getElementById('inicioProyecto')) {
      document.getElementById('inicioProyecto').value = c.inicioProyecto || 'Una vez confirmado el anticipo';
    }
    if (document.getElementById('notas')) {
      document.getElementById('notas').value = c.notas || '';
    }

    // Impuestos
    if (ivaInput) {
      ivaInput.value = c.ivaPorcentaje ?? configuracion?.ivaPorcentajeDefault ?? 19;
    }
    if (checkIVA) {
      checkIVA.checked = c.aplicarIVA !== false;
    }

    if (retefuenteInput) {
      retefuenteInput.value = c.retefuentePorcentaje ?? configuracion?.retefuentePorcentajeDefault ?? 2.5;
    }
    if (checkRetefuente) {
      checkRetefuente.checked = c.aplicarReteFuente !== false;
    }

    if (reteicaInput) {
      reteicaInput.value = c.reteicaPorcentaje ?? configuracion?.reteicaPorcentajeDefault ?? 0.69;
    }
    if (checkReteICA) {
      checkReteICA.checked = c.aplicarReteICA !== undefined
        ? Boolean(c.aplicarReteICA)
        : Boolean(configuracion?.aplicarReteIcaDefault);
    }

    if (document.getElementById('estado')) {
      document.getElementById('estado').value = c.estado || 'borrador';
    }
    if (document.getElementById('vigenteHasta')) {
      document.getElementById('vigenteHasta').value = c.vigenteHasta || '';
    }

    // Ítems de productos
    itemsBody.innerHTML = '';
    const items = c.items && c.items.length ? c.items : [{}];
    items.forEach((item) => crearFilaItem(item));

    calcularTotales();
  }

  // ----------------------------------------------------------------------------
  // 4. GUARDADO Y DESCARGA / IMPRESIÓN
  // ----------------------------------------------------------------------------

  /**
   * Guarda o actualiza la cotización y opcionalmente descarga / imprime el PDF
   * @param {object} opciones - { descargarPdf: boolean }
   */
  async function guardarCotizacion({ descargarPdf = false } = {}) {
    UI.clearMessage();

    const payload = construirPayload();

    if (!payload.destinatario.nombre) {
      UI.showMessage('error', 'Por favor escriba el nombre del destinatario.');
      document.getElementById('destinatarioNombre')?.focus();
      return null;
    }

    if (!payload.items.length || payload.items.some((i) => !i.descripcion)) {
      UI.showMessage('error', 'Cada producto debe tener al menos una descripción.');
      return null;
    }

    try {
      if (btnGuardar) btnGuardar.disabled = true;
      if (btnImprimir) btnImprimir.disabled = true;
      if (btnImprimirAbajo) btnImprimirAbajo.disabled = true;

      let guardada;
      const targetId = cotizacionActual?.id || editId;

      if (targetId) {
        guardada = await Api.actualizarCotizacion(targetId, payload);
      } else {
        guardada = await Api.crearCotizacion(payload);
      }

      cotizacionActual = guardada;

      // Guarda el archivo PDF directamente en la carpeta /pdf del servidor y opcionalmente descarga
      if (window.PdfCotizacion) {
        await PdfCotizacion.guardarPdfEnServidor(guardada, descargarPdf);
      }

      const safeFolio = (guardada.folio || 'cotizacion').replace(/[^\w\-]/g, '_');
      if (btnVerPdf) {
        btnVerPdf.href = `/pdf/${safeFolio}.pdf`;
        btnVerPdf.hidden = false;
      }

      if (btnWhatsApp) btnWhatsApp.hidden = false;
      if (btnCorreo) btnCorreo.hidden = false;

      const badgeDuplicada = guardada.duplicadaDeFolio
        ? ` <span class="card__badge" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;font-size:0.85rem;padding:0.25rem 0.65rem;border-radius:20px;font-weight:600;margin-left:0.5rem;vertical-align:middle;display:inline-flex;align-items:center;gap:0.3rem;">📑 Copia de ${guardada.duplicadaDeFolio}</span>`
        : '';
      if (tituloPagina) {
        tituloPagina.innerHTML = `Editar cotización ${guardada.folio}${badgeDuplicada}`;
      }

      UI.showMessage(
        'exito',
        descargarPdf
          ? `Cotización ${guardada.folio} guardada con éxito y PDF generado para impresión/descarga.`
          : `Cotización ${guardada.folio} guardada con éxito y almacenada en el servidor.`
      );

      if (!editId) {
        window.history.replaceState({}, '', `/cotizacion.html?id=${guardada.id}`);
      }

      return guardada;
    } catch (err) {
      UI.showMessage('error', `Error al guardar cotización: ${err.message}`);
      return null;
    } finally {
      if (btnGuardar) btnGuardar.disabled = false;
      if (btnImprimir) btnImprimir.disabled = false;
      if (btnImprimirAbajo) btnImprimirAbajo.disabled = false;
    }
  }

  // ----------------------------------------------------------------------------
  // 5. LISTENERS Y EVENTOS DE INTERFAZ
  // ----------------------------------------------------------------------------

  // Botón guardar cotización
  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => guardarCotizacion({ descargarPdf: false }));
  }

  // Botones imprimir / descargar PDF
  if (btnImprimir) {
    btnImprimir.addEventListener('click', () => guardarCotizacion({ descargarPdf: true }));
  }
  if (btnImprimirAbajo) {
    btnImprimirAbajo.addEventListener('click', () => guardarCotizacion({ descargarPdf: true }));
  }

  // Envío tradicional del formulario
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      guardarCotizacion({ descargarPdf: false });
    });
  }

  // Selección de cliente existente
  if (clienteSelect) {
    clienteSelect.addEventListener('change', () => {
      const cliente = clientes.find((c) => c.id === clienteSelect.value);
      if (cliente) {
        if (document.getElementById('destinatarioNombre')) document.getElementById('destinatarioNombre').value = cliente.nombre || '';
        if (document.getElementById('destinatarioEmpresa')) document.getElementById('destinatarioEmpresa').value = cliente.empresa || '';
        if (document.getElementById('destinatarioTelefono')) document.getElementById('destinatarioTelefono').value = cliente.telefono || '';
        if (document.getElementById('destinatarioEmail')) document.getElementById('destinatarioEmail').value = cliente.email || '';
        if (document.getElementById('destinatarioDireccion')) document.getElementById('destinatarioDireccion').value = cliente.direccion || '';
        if (document.getElementById('destinatarioNIT')) document.getElementById('destinatarioNIT').value = cliente.nit || '';
        if (document.getElementById('destinatarioTipoCliente')) document.getElementById('destinatarioTipoCliente').value = cliente.tipoCliente || 'persona';
      }
      calcularTotales();
    });
  }

  // Guardado rápido de cliente manual en directorio
  if (btnGuardarClienteManual) {
    btnGuardarClienteManual.addEventListener('click', async () => {
      const nombre = (document.getElementById('destinatarioNombre')?.value || '').trim();
      const nit = (document.getElementById('destinatarioNIT')?.value || '').trim();

      if (!nombre) {
        UI.showMessage('error', 'Por favor ingrese al menos el nombre del cliente para guardarlo.');
        document.getElementById('destinatarioNombre')?.focus();
        return;
      }

      function normalizar(txt) {
        if (!txt) return '';
        return String(txt)
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ');
      }

      function normalizarDoc(doc) {
        if (!doc) return '';
        return String(doc).replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      }

      const normNombre = normalizar(nombre);
      const normNit = normalizarDoc(nit);

      const clienteExistente = clientes.find((c) => {
        if (normalizar(c.nombre) === normNombre) return true;
        if (normNit && c.nit && normalizarDoc(c.nit) === normNit) return true;
        return false;
      });

      if (clienteExistente) {
        if (clienteSelect) clienteSelect.value = clienteExistente.id;
        UI.showMessage(
          'info',
          `El cliente "${clienteExistente.nombre}" ya existe en el directorio. Se vinculó automáticamente.`
        );
        calcularTotales();
        return;
      }

      const payload = {
        nombre,
        empresa: (document.getElementById('destinatarioEmpresa')?.value || '').trim(),
        telefono: (document.getElementById('destinatarioTelefono')?.value || '').trim(),
        email: (document.getElementById('destinatarioEmail')?.value || '').trim(),
        direccion: (document.getElementById('destinatarioDireccion')?.value || '').trim(),
        nit,
        tipoCliente: document.getElementById('destinatarioTipoCliente')?.value || 'persona',
      };

      try {
        btnGuardarClienteManual.disabled = true;
        const nuevoCliente = await Api.crearCliente(payload);
        clientes.push(nuevoCliente);
        cargarClientesSelect();
        if (clienteSelect) clienteSelect.value = nuevoCliente.id;
        UI.showMessage('exito', `Cliente "${nuevoCliente.nombre}" guardado con éxito en el directorio.`);
        calcularTotales();
      } catch (err) {
        UI.showMessage('error', `Error al guardar cliente: ${err.message}`);
      } finally {
        btnGuardarClienteManual.disabled = false;
      }
    });
  }

  // Guardar solo el estado sin regenerar ni descargar PDF
  if (btnGuardarSoloEstado) {
    btnGuardarSoloEstado.addEventListener('click', async () => {
      const targetId = cotizacionActual?.id || editId;
      const nuevoEstado = document.getElementById('estado')?.value || 'borrador';

      if (!targetId) {
        UI.showMessage(
          'info',
          `El estado "${nuevoEstado.toUpperCase()}" quedará asignado al guardar la cotización.`
        );
        return;
      }

      try {
        btnGuardarSoloEstado.disabled = true;
        await Api.actualizarCotizacion(targetId, { estado: nuevoEstado });
        if (cotizacionActual) cotizacionActual.estado = nuevoEstado;
        UI.showMessage(
          'exito',
          `Estado de ${cotizacionActual?.folio || 'la cotización'} actualizado a "${nuevoEstado.toUpperCase()}" correctamente.`
        );
      } catch (err) {
        UI.showMessage('error', `Error al actualizar estado: ${err.message}`);
      } finally {
        btnGuardarSoloEstado.disabled = false;
      }
    });
  }

  // Agregar nuevo producto
  if (btnAgregarItem) {
    btnAgregarItem.addEventListener('click', () => {
      crearFilaItem();
    });
  }

  // Cambio de producto en una fila de la tabla
  if (itemsBody) {
    itemsBody.addEventListener('change', (e) => {
      if (!e.target.classList.contains('item-producto')) return;
      const tr = e.target.closest('.items__fila');
      const producto = productos.find((p) => p.id === e.target.value);
      if (!tr) return;

      const descInput = tr.querySelector('.item-descripcion');
      const precioInput = tr.querySelector('.item-precio');
      const descItemInput = tr.querySelector('.item-descuento');

      if (producto) {
        if (descInput) {
          descInput.value = producto.nombre + (producto.descripcion ? ` — ${producto.descripcion}` : '');
        }
        if (precioInput) {
          precioInput.value = producto.precio ?? 0;
        }
        if (descItemInput) {
          const reglaDesc = descuentos.find((d) => d.tipo === 'producto' && d.referenciaId === producto.id);
          descItemInput.value = reglaDesc?.porcentaje || 0;
        }
      } else {
        if (descInput) descInput.value = '';
        if (precioInput) precioInput.value = 0;
        if (descItemInput) descItemInput.value = 0;
      }

      calcularTotales();
    });

    // Recalculo al editar valores numéricos en la tabla
    itemsBody.addEventListener('input', (e) => {
      if (
        e.target.classList.contains('item-cantidad') ||
        e.target.classList.contains('item-precio') ||
        e.target.classList.contains('item-descuento')
      ) {
        calcularTotales();
      }
    });

    // Click en acciones de fila (Alternar catálogo/manual, guardar en catálogo o quitar fila)
    itemsBody.addEventListener('click', async (e) => {
      // 1. Alternar entre modo catálogo y modo manual
      const btnToggle = e.target.closest('.btn-toggle-modo');
      if (btnToggle) {
        const tr = btnToggle.closest('.items__fila');
        if (!tr) return;
        const inputDesc = tr.querySelector('.item-descripcion');
        const selectProd = tr.querySelector('.item-producto');
        const btnGuardarProd = tr.querySelector('.btn-guardar-producto');
        const enCatalogo = selectProd && selectProd.style.display !== 'none';

        if (enCatalogo) {
          selectProd.style.display = 'none';
          inputDesc.style.display = 'block';
          inputDesc.required = true;
          if (btnGuardarProd) btnGuardarProd.style.display = 'inline-flex';
          btnToggle.innerHTML = '📦 Catálogo';
          btnToggle.title = 'Elegir producto del catálogo';
          inputDesc.focus();
        } else {
          inputDesc.style.display = 'none';
          inputDesc.required = false;
          selectProd.style.display = 'block';
          if (btnGuardarProd) btnGuardarProd.style.display = 'none';
          btnToggle.innerHTML = '✏️ Manual';
          btnToggle.title = 'Cambiar a escribir manualmente';
          selectProd.focus();
        }
        calcularTotales();
        return;
      }

      // 2. Botón para guardar material manual directamente en el catálogo
      const btnGuardarProd = e.target.closest('.btn-guardar-producto');
      if (btnGuardarProd) {
        const tr = btnGuardarProd.closest('.items__fila');
        if (!tr) return;
        const descInput = tr.querySelector('.item-descripcion');
        const precioInput = tr.querySelector('.item-precio');
        const nombre = descInput?.value.trim();
        const precio = Number(precioInput?.value) || 0;

        if (!nombre) {
          UI.showMessage('error', 'Escriba el nombre o descripción del producto para guardarlo.');
          descInput?.focus();
          return;
        }
        if (precio <= 0) {
          UI.showMessage('error', 'El precio unitario debe ser mayor a 0 para guardar en catálogo.');
          precioInput?.focus();
          return;
        }

        function normalizar(txt) {
          if (!txt) return '';
          return String(txt)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ');
        }

        const norm = normalizar(nombre);
        const prodExistente = productos.find((p) => normalizar(p.nombre) === norm);

        if (prodExistente) {
          const selectFila = tr.querySelector('.item-producto');
          const btnToggleFila = tr.querySelector('.btn-toggle-modo');
          if (selectFila && descInput && btnToggleFila) {
            descInput.style.display = 'none';
            descInput.required = false;
            selectFila.style.display = 'block';
            selectFila.value = prodExistente.id;
            btnToggleFila.innerHTML = '✏️ Manual';
            btnToggleFila.title = 'Cambiar a escribir manualmente';
            btnGuardarProd.style.display = 'none';
          }
          UI.showMessage(
            'info',
            `El producto "${prodExistente.nombre}" ya existe en el catálogo. Se vinculó automáticamente.`
          );
          calcularTotales();
          return;
        }

        try {
          btnGuardarProd.disabled = true;
          const nuevoProd = await Api.crearProducto({
            nombre,
            precio,
            unidad: 'pza',
            stockActual: 0,
            stockMinimo: 0,
          });

          productos.push(nuevoProd);

          // Actualizar todos los selects de productos en la tabla
          const todosSelects = itemsBody.querySelectorAll('.item-producto');
          todosSelects.forEach((sel) => {
            const valActual = sel.value;
            sel.innerHTML = `
              <option value="">— Elegir del catálogo —</option>
              ${productos.map((p) => `<option value="${p.id}" ${p.id === valActual ? 'selected' : ''}>${p.nombre}${p.descripcion ? ` — ${p.descripcion}` : ''}</option>`).join('')}
            `;
          });

          // Cambiar fila actual a modo catálogo
          const selectFila = tr.querySelector('.item-producto');
          const btnToggleFila = tr.querySelector('.btn-toggle-modo');
          if (selectFila && descInput && btnToggleFila) {
            descInput.style.display = 'none';
            descInput.required = false;
            selectFila.style.display = 'block';
            selectFila.value = nuevoProd.id;
            btnToggleFila.innerHTML = '✏️ Manual';
            btnToggleFila.title = 'Cambiar a escribir manualmente';
            btnGuardarProd.style.display = 'none';
          }

          UI.showMessage('exito', `Material "${nuevoProd.nombre}" guardado exitosamente en el catálogo.`);
          calcularTotales();
        } catch (err) {
          UI.showMessage('error', `Error al guardar producto: ${err.message}`);
        } finally {
          btnGuardarProd.disabled = false;
        }
        return;
      }

      // 3. Quitar fila de la tabla
      const btn = e.target.closest('.btn-quitar');
      if (btn) {
        const filas = itemsBody.querySelectorAll('.items__fila');
        if (filas.length <= 1) {
          UI.showMessage('error', 'Debe dejar al menos un producto en la cotización.');
          return;
        }

        btn.closest('.items__fila').remove();
        calcularTotales();
      }
    });
  }

  // Reactividad en impuestos
  if (ivaInput) ivaInput.addEventListener('input', calcularTotales);
  if (checkIVA) checkIVA.addEventListener('change', calcularTotales);
  if (retefuenteInput) retefuenteInput.addEventListener('input', calcularTotales);
  if (checkRetefuente) checkRetefuente.addEventListener('change', calcularTotales);
  if (reteicaInput) reteicaInput.addEventListener('input', calcularTotales);
  if (checkReteICA) checkReteICA.addEventListener('change', calcularTotales);

  // ----------------------------------------------------------------------------
  // 6. DESPACHO POR WHATSAPP Y CORREO
  // ----------------------------------------------------------------------------
  const btnCerrarModalWhatsApp = document.getElementById('btnCerrarModalWhatsApp');
  const btnCancelarWhatsApp = document.getElementById('btnCancelarWhatsApp');
  const btnConfirmarWhatsApp = document.getElementById('btnConfirmarWhatsApp');
  const waAlertaFijo = document.getElementById('waAlertaFijo');
  const waTextoTelCliente = document.getElementById('waTextoTelCliente');
  const waOpcionClienteLabel = document.getElementById('waOpcionClienteLabel');
  const waDestinoCliente = document.getElementById('waDestinoCliente');
  const waDescCliente = document.getElementById('waDescCliente');
  const waDestinoEmpresa = document.getElementById('waDestinoEmpresa');
  const waDescEmpresa = document.getElementById('waDescEmpresa');
  const waDestinoManual = document.getElementById('waDestinoManual');
  const waNumeroManual = document.getElementById('waNumeroManual');
  const waMensajeTexto = document.getElementById('waMensajeTexto');

  let waFormattedCliente = '';
  let waFormattedEmpresa = '';
  let waMsgClienteCache = '';
  let waMsgEmpresaCache = '';

  if (btnCerrarModalWhatsApp) {
    btnCerrarModalWhatsApp.addEventListener('click', () => UI.closeModal('modalWhatsApp'));
  }
  if (btnCancelarWhatsApp) {
    btnCancelarWhatsApp.addEventListener('click', () => UI.closeModal('modalWhatsApp'));
  }

  document.querySelectorAll('input[name="waDestino"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!waMensajeTexto) return;
      if (radio.value === 'empresa') {
        waMensajeTexto.value = waMsgEmpresaCache;
      } else {
        waMensajeTexto.value = waMsgClienteCache;
      }
    });
  });

  if (waNumeroManual) {
    waNumeroManual.addEventListener('focus', () => {
      if (waDestinoManual) waDestinoManual.checked = true;
      if (waMensajeTexto && !waMensajeTexto.value) waMensajeTexto.value = waMsgClienteCache;
    });
  }

  if (btnWhatsApp) {
    btnWhatsApp.addEventListener('click', async () => {
      try {
        btnWhatsApp.disabled = true;
        const cfg = configuracion || (await Api.getConfiguracion());
        const payload = construirPayload();
        const data = {
          ...(cotizacionActual || {}),
          ...payload,
          folio: cotizacionActual?.folio || 'COTIZACION',
          creadoEn: cotizacionActual?.creadoEn || new Date().toISOString(),
        };

        if (window.PdfCotizacion) {
          await PdfCotizacion.guardarPdfEnServidor(data, false);
        }
        const safeFolio = (data.folio || 'cotizacion').replace(/[^\w\-]/g, '_');
        const waLinkPdf = document.getElementById('waLinkPdf');
        if (waLinkPdf) {
          waLinkPdf.href = `/pdf/${safeFolio}.pdf`;
        }

        const rawCliente = String(data.destinatario?.telefono || '').trim();
        const digitsCliente = rawCliente.replace(/\D/g, '');
        const isMobileCliente =
          /^573\d{9}$/.test(digitsCliente) || (/^3\d{9}$/.test(digitsCliente) && digitsCliente.length === 10);

        waFormattedCliente = digitsCliente.startsWith('57') ? digitsCliente : `57${digitsCliente}`;

        const rawEmpresa = String(cfg?.whatsapp?.numero || cfg?.empresa?.telefono || '3143754285').trim();
        const digitsEmpresa = rawEmpresa.replace(/\D/g, '');
        waFormattedEmpresa = digitsEmpresa.startsWith('57') ? digitsEmpresa : `57${digitsEmpresa}`;
        const nombreEmpresa = cfg?.empresa?.nombre || 'Depósito de Flejes San Martín';

        const plantilla =
          cfg?.whatsapp?.mensaje ||
          'Hola {cliente}, le compartimos la cotización {folio} por un total de {total}.';

        waMsgClienteCache =
          plantilla
            .replace('{cliente}', data.destinatario?.nombre || 'Cliente')
            .replace('{folio}', data.folio || '')
            .replace('{total}', UI.money(data.total)) +
          `\n\n• Anticipo 50%: ${UI.money(data.anticipo)}\n• Saldo 50%: ${UI.money(data.saldo)}\n• Tiempo de entrega: ${data.tiempoEntrega || '2 a 5 días hábiles'}\n\nAdjuntamos el documento PDF con el desglose detallado.`;

        waMsgEmpresaCache = `📄 *Copia de Cotización ${data.folio || ''}*\n• Cliente: ${data.destinatario?.nombre || 'Sin nombre'}\n• Empresa / Obra: ${data.destinatario?.empresa || '—'}\n• Teléfono Cliente: ${rawCliente || '—'}\n• Total: ${UI.money(data.total)}\n• Anticipo (50%): ${UI.money(data.anticipo)}\n• Saldo (50%): ${UI.money(data.saldo)}\n• Tiempo de entrega: ${data.tiempoEntrega || '2 a 5 días hábiles'}`;

        if (waDescEmpresa) {
          waDescEmpresa.textContent = `${nombreEmpresa} — (+${waFormattedEmpresa})`;
        }

        if (isMobileCliente) {
          if (waOpcionClienteLabel) waOpcionClienteLabel.style.display = 'flex';
          if (waAlertaFijo) waAlertaFijo.style.display = 'none';
          if (waDestinoCliente) waDestinoCliente.checked = true;
          if (waDescCliente) {
            waDescCliente.textContent = `${data.destinatario?.nombre || 'Cliente'} — ${rawCliente}`;
          }
          if (waMensajeTexto) waMensajeTexto.value = waMsgClienteCache;
        } else {
          if (waOpcionClienteLabel) waOpcionClienteLabel.style.display = 'none';
          if (rawCliente) {
            if (waAlertaFijo) waAlertaFijo.style.display = 'block';
            if (waTextoTelCliente) waTextoTelCliente.textContent = rawCliente;
          } else {
            if (waAlertaFijo) waAlertaFijo.style.display = 'none';
          }
          if (waDestinoEmpresa) waDestinoEmpresa.checked = true;
          if (waMensajeTexto) waMensajeTexto.value = waMsgEmpresaCache;
        }

        UI.openModal('modalWhatsApp');
      } catch (err) {
        UI.showMessage('error', `No se pudo preparar WhatsApp: ${err.message}`);
      } finally {
        btnWhatsApp.disabled = false;
      }
    });
  }

  if (btnConfirmarWhatsApp) {
    btnConfirmarWhatsApp.addEventListener('click', () => {
      let targetNumber = '';
      const destinoSeleccionado = document.querySelector('input[name="waDestino"]:checked')?.value;

      if (destinoSeleccionado === 'cliente') {
        targetNumber = waFormattedCliente;
      } else if (destinoSeleccionado === 'empresa') {
        targetNumber = waFormattedEmpresa;
      } else if (destinoSeleccionado === 'manual') {
        const manVal = (waNumeroManual?.value || '').replace(/\D/g, '');
        if (!manVal || manVal.length < 7) {
          UI.showMessage('error', 'Por favor ingrese un número de celular válido para WhatsApp.');
          waNumeroManual?.focus();
          return;
        }
        targetNumber = manVal.startsWith('57') ? manVal : `57${manVal}`;
      }

      if (!targetNumber) {
        UI.showMessage('error', 'No se pudo determinar el número de WhatsApp de destino.');
        return;
      }

      const mensaje = waMensajeTexto?.value || '';
      window.open(`https://wa.me/${targetNumber}?text=${encodeURIComponent(mensaje)}`, '_blank');
      UI.closeModal('modalWhatsApp');
      UI.showMessage(
        'exito',
        'WhatsApp abierto con éxito. Recuerda adjuntar el archivo PDF descargado en la conversación.'
      );
    });
  }

  if (btnCorreo) {
    btnCorreo.addEventListener('click', async () => {
      const data = { ...(cotizacionActual || {}), ...construirPayload() };
      const correo = data.destinatario?.email;

      if (!correo) {
        UI.showMessage('error', 'El destinatario no tiene correo electrónico registrado.');
        document.getElementById('destinatarioEmail')?.focus();
        return;
      }

      try {
        btnCorreo.disabled = true;
        const doc = await PdfCotizacion.generar(data);
        const pdfBase64 = doc.output('datauristring');

        await Api.enviarCorreo({
          destinatario: correo,
          asunto: `Cotización ${data.folio || ''} - Depósito de Flejes San Martín`,
          mensaje: `Estimado(a) ${data.destinatario.nombre},\n\nAdjuntamos la cotización solicitada.\n\nAtentamente,\nDepósito de Flejes San Martín`,
          pdfBase64,
          nombreArchivo: `${data.folio || 'cotizacion'}.pdf`,
        });

        UI.showMessage('exito', 'Correo enviado correctamente al cliente.');
      } catch (err) {
        UI.showMessage('error', `Error enviando correo: ${err.message}`);
      } finally {
        btnCorreo.disabled = false;
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 7. GESTIÓN DE TIEMPOS DE ENTREGA (LUNES A SÁBADO)
  // ----------------------------------------------------------------------------

  function esDiaHabil(fecha) {
    return fecha.getDay() !== 0; // 0 = Domingo
  }

  function formatDateInput(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function obtenerFechaDiaHabil(fechaBase, nDia) {
    const d = new Date(fechaBase);
    d.setHours(12, 0, 0, 0);

    const diaSemanaBase = d.getDay();
    if (diaSemanaBase === 5) {
      d.setDate(d.getDate() + 3);
    } else if (diaSemanaBase === 6) {
      d.setDate(d.getDate() + 2);
    } else if (diaSemanaBase === 0) {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 1);
    }

    let restantes = nDia - 1;
    while (restantes > 0) {
      d.setDate(d.getDate() + 1);
      if (esDiaHabil(d)) {
        restantes--;
      }
    }
    return d;
  }

  function contarDiasHabiles(fechaBase, fechaDestino) {
    const inicio = new Date(fechaBase);
    inicio.setHours(12, 0, 0, 0);
    const fin = new Date(fechaDestino);
    fin.setHours(12, 0, 0, 0);

    if (fin < inicio) return 1;

    const diaSemanaBase = inicio.getDay();
    let d = new Date(inicio);
    if (diaSemanaBase === 5) {
      d.setDate(d.getDate() + 3);
    } else if (diaSemanaBase === 6) {
      d.setDate(d.getDate() + 2);
    } else if (diaSemanaBase === 0) {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 1);
    }

    if (fin < d) return 1;

    let count = 1;
    while (d < fin) {
      d.setDate(d.getDate() + 1);
      if (esDiaHabil(d)) {
        count++;
      }
    }
    return Math.max(1, count);
  }

  function inicializarCalendarioEntrega(fechaCreacion = new Date()) {
    const base = new Date(fechaCreacion);
    const fechaMin = obtenerFechaDiaHabil(base, 2);
    const fechaMax = obtenerFechaDiaHabil(base, 5);

    if (inputEntregaDesde) inputEntregaDesde.value = formatDateInput(fechaMin);
    if (inputEntregaHasta) inputEntregaHasta.value = formatDateInput(fechaMax);
    if (inputTiempoEntrega && !inputTiempoEntrega.value) {
      inputTiempoEntrega.value = '2 a 5 días hábiles';
    }
  }

  function actualizarTiempoEntregaDesdeCalendario() {
    if (!inputEntregaDesde || !inputEntregaHasta || !inputTiempoEntrega) return;
    if (!inputEntregaDesde.value || !inputEntregaHasta.value) return;

    const fechaBase = cotizacionActual?.creadoEn ? new Date(cotizacionActual.creadoEn) : new Date();
    const d1 = contarDiasHabiles(fechaBase, new Date(`${inputEntregaDesde.value}T12:00:00`));
    const d2 = contarDiasHabiles(fechaBase, new Date(`${inputEntregaHasta.value}T12:00:00`));

    const minDias = Math.min(d1, d2);
    const maxDias = Math.max(d1, d2);

    if (minDias === maxDias) {
      inputTiempoEntrega.value = `${minDias} día${minDias === 1 ? '' : 's'} hábil${minDias === 1 ? '' : 'es'}`;
    } else {
      inputTiempoEntrega.value = `${minDias} a ${maxDias} días hábiles`;
    }
  }

  if (inputEntregaDesde) {
    inputEntregaDesde.addEventListener('change', actualizarTiempoEntregaDesdeCalendario);
  }
  if (inputEntregaHasta) {
    inputEntregaHasta.addEventListener('change', actualizarTiempoEntregaDesdeCalendario);
  }

  // ----------------------------------------------------------------------------
  // 8. INICIALIZACIÓN PRINCIPAL
  // ----------------------------------------------------------------------------

  async function init() {
    try {
      [clientes, productos, descuentos, configuracion] = await Promise.all([
        Api.getClientes().catch(() => []),
        Api.getProductos().catch(() => []),
        Api.getDescuentos().catch(() => []),
        Api.getConfiguracion().catch(() => null),
      ]);

      cargarClientesSelect();

      if (editId) {
        const cotizacion = await Api.getCotizacion(editId);
        llenarFormulario(cotizacion);

        if (reimprimir && window.PdfCotizacion) {
          await PdfCotizacion.guardarYDescargar(cotizacion);
          UI.showMessage('exito', 'PDF reimpreso automáticamente.');
        }
      } else {
        // Nueva cotización
        if (configuracion) {
          if (ivaInput) ivaInput.value = configuracion.ivaPorcentajeDefault ?? 19;
          if (checkIVA) checkIVA.checked = configuracion.aplicarIvaDefault !== false;
          if (retefuenteInput) retefuenteInput.value = configuracion.retefuentePorcentajeDefault ?? 2.5;
          if (checkRetefuente) checkRetefuente.checked = configuracion.aplicarReteFuenteDefault !== false;
          if (reteicaInput) reteicaInput.value = configuracion.reteicaPorcentajeDefault ?? 0.69;
          if (checkReteICA) checkReteICA.checked = Boolean(configuracion.aplicarReteIcaDefault);
        }

        inicializarCalendarioEntrega();
        crearFilaItem();
        calcularTotales();
      }
    } catch (err) {
      UI.showMessage('error', `Error al inicializar el cotizador: ${err.message}`);
      inicializarCalendarioEntrega();
      if (!itemsBody.children.length) {
        crearFilaItem();
      }
      calcularTotales();
    }
  }

  init();
});
