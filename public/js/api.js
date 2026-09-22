/**
 * ==============================================================================
 * CLIENTE HTTP CENTRALIZADO (API WRAPPER)
 * ==============================================================================
 * Proporciona métodos normalizados para interactuar con la API REST del backend.
 * Gestiona encabezados JSON y captura unificada de errores.
 * ==============================================================================
 */

const Api = {
  /**
   * Ejecuta peticiones fetch con manejo estandarizado de JSON y errores.
   * @param {string} url - Ruta relativa o absoluta
   * @param {object} options - Opciones de fetch (method, body, headers, etc.)
   * @returns {Promise<any>} Respuesta deserializada
   */
  async request(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Ocurrió un error en la comunicación con el servidor');
    }

    return data;
  },

  // ----------------------------------------------------------------------------
  // Cotizaciones
  // ----------------------------------------------------------------------------
  getCotizaciones() {
    return this.request('/api/cotizaciones');
  },

  getCotizacion(id) {
    return this.request(`/api/cotizaciones/${id}`);
  },

  crearCotizacion(payload) {
    return this.request('/api/cotizaciones', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  actualizarCotizacion(id, payload) {
    return this.request(`/api/cotizaciones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  eliminarCotizacion(id) {
    return this.request(`/api/cotizaciones/${id}`, {
      method: 'DELETE',
    });
  },

  duplicarCotizacion(id) {
    return this.request(`/api/cotizaciones/${id}/duplicar`, {
      method: 'POST',
    });
  },

  // ----------------------------------------------------------------------------
  // Clientes
  // ----------------------------------------------------------------------------
  getClientes() {
    return this.request('/api/clientes');
  },

  crearCliente(payload) {
    return this.request('/api/clientes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  actualizarCliente(id, payload) {
    return this.request(`/api/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  eliminarCliente(id) {
    return this.request(`/api/clientes/${id}`, {
      method: 'DELETE',
    });
  },

  // ----------------------------------------------------------------------------
  // Productos e Inventario
  // ----------------------------------------------------------------------------
  getProductos() {
    return this.request('/api/productos');
  },

  crearProducto(payload) {
    return this.request('/api/productos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  actualizarProducto(id, payload) {
    return this.request(`/api/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  eliminarProducto(id) {
    return this.request(`/api/productos/${id}`, {
      method: 'DELETE',
    });
  },

  getAlertasInventario() {
    return this.request('/api/inventario/alertas');
  },

  // ----------------------------------------------------------------------------
  // Descuentos y Configuración
  // ----------------------------------------------------------------------------
  getDescuentos() {
    return this.request('/api/descuentos');
  },

  guardarDescuentos(descuentos) {
    return this.request('/api/descuentos', {
      method: 'PUT',
      body: JSON.stringify(descuentos),
    });
  },

  getConfiguracion() {
    return this.request('/api/configuracion');
  },

  guardarConfiguracion(configuracion) {
    return this.request('/api/configuracion', {
      method: 'PUT',
      body: JSON.stringify(configuracion),
    });
  },

  crearRespaldo() {
    return this.request('/api/respaldos', {
      method: 'POST',
    });
  },

  // ----------------------------------------------------------------------------
  // PDF y Despacho de Correo
  // ----------------------------------------------------------------------------
  guardarPdf(folio, pdfBase64) {
    return this.request('/api/pdf', {
      method: 'POST',
      body: JSON.stringify({ folio, pdfBase64 }),
    });
  },

  enviarCorreo(payload) {
    return this.request('/api/correo/enviar', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
