# 04 - Interfaz de Usuario y Frontend

El frontend está implementado en Vanilla JavaScript (ES6+), HTML5 semántico y CSS3 modular sin dependencias externas de diseño.

---

## 🎨 1. Sistema de Diseño y Tokens CSS (`public/css/variables.css`)

### Paleta de Colores Corporativa
- **Azul Primario (Identidad)**: `--color-primario: #0b234b;`
- **Azul Hover**: `--color-primario-hover: #12376e;`
- **Secundario (Superficie)**: `--color-secundario: #eef3f9;`
- **Fondo General**: `--color-fondo: #f6f8fb;`
- **Superficie de Tarjetas**: `--color-tarjeta: #ffffff;`
- **Bordes y Divisores**: `--color-borde: #dbe3ed;`
- **Texto Principal**: `--color-texto: #1f2937;`
- **Texto Secundario (Gris)**: `--color-texto-secundario: #6e6e6e;`
- **Éxito**: `--color-exito: #059669;` / `--color-exito-fondo: #ecfdf5;`
- **Peligro / Alerta**: `--color-peligro: #dc2626;` / `--color-peligro-fondo: #fef2f2;`

### Tipografía y Espaciado
- **Fuente Principal**: `Roboto, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`
- **Radios de Borde**: `--radio-sm: 4px;`, `--radio: 8px;`, `--radio-lg: 12px;`
- **Sombras**:
  - `--sombra-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);`
  - `--sombra: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);`

---

## 📄 2. Catálogo de Vistas HTML

| Archivo | Ruta | Propósito | Componentes Clave |
| :--- | :--- | :--- | :--- |
| `index.html` | `/` o `/index.html` | Pantalla de bienvenida (Landing) | Resumen comercial institucional y acceso directo al panel |
| `dashboard.html` | `/dashboard.html` | Panel principal de cotizaciones | Buscador por texto, filtros de estado/fecha, métricas KPIs, alertas de stock, duplicar, anular y abrir PDF |
| `cotizacion.html` | `/cotizacion.html` | Crear / Editar cotización | Selector de cliente, tabla optimizada de 5 columnas (sin columna innecesaria de unidad), caja de totales con atenuación limpia de impuestos inactivos, tarjeta automática de condiciones 50/50, botones de PDF/WhatsApp/Email |
| `productos.html` | `/productos.html` | Catálogo y Stock | Formulario de creación de productos, tabla con badges de alerta de stock mínimo, modal de edición |
| `clientes.html` | `/clientes.html` | Directorio de clientes | Formulario de nuevo cliente, lista de tarjetas con acciones de editar y eliminar |
| `descuentos.html` | `/descuentos.html` | Matriz de descuentos | Formulario para ligar % de descuento a cliente/producto, grid de reglas activas |
| `configuracion.html`| `/configuracion.html`| Parámetros del sistema | Configuración de impuestos por defecto (IVA, Retefuente y ReteICA con switches de activación), formulario de WhatsApp, credenciales SMTP con password masked, botón de creación de snapshot |

---

## 🧩 3. Módulos y Controladores JavaScript

### Capa de Servicio API (`public/js/api.js`)
Objeto global `window.Api` que encapsula todas las llamadas `fetch()` con manejo de errores estandarizado:
- `getCotizaciones()`, `getCotizacion(id)`, `crearCotizacion(data)`, `actualizarCotizacion(id, data)`, `eliminarCotizacion(id)`, `duplicarCotizacion(id)`.
- `getClientes()`, `crearCliente(data)`, `actualizarCliente(id, data)`, `eliminarCliente(id)`.
- `getProductos()`, `crearProducto(data)`, `actualizarProducto(id, data)`, `eliminarProducto(id)`, `getAlertasInventario()`.
- `getDescuentos()`, `guardarDescuentos(descuentos)`.
- `getConfiguracion()`, `guardarConfiguracion(data)`.
- `crearRespaldo()`, `enviarCorreo(data)`, `guardarPdf(folio, pdfBase64)`.

### Capa de Utilidades UI (`public/js/ui.js`)
Objeto global `window.UI`:
- `UI.money(valor)`: Formatea valores numéricos a moneda colombiana (`$X.XXX` sin decimales con separador de miles por punto).
- `UI.formatDate(isoString)`: Convierte fechas ISO a formato localizado corto `DD/MM/YYYY` en español (`es-CO`).
- `UI.showMessage(tipo, mensaje)`: Renderiza banners flash de notificación en `#mensaje` con estilos semánticos (`exito`, `error`, `info`) y scroll suave hacia arriba.
- `UI.clearMessage()`: Remueve y oculta cualquier notificación activa en el DOM.
- `UI.openModal(id)` / `UI.closeModal(id)`: Control de apertura y cierre de ventanas modales.
- `UI.initMenu()`: Alternancia del menú lateral responsive para pantallas móviles.

### Formulario Dinámico de Cotización (`public/js/cotizacion.js`)
- **Tabla optimizada con guardado rápido**: Cada fila cuenta con un selector inteligente que unifica la entrada de texto y el catálogo: el usuario puede escribir directamente a mano o pulsar el botón `📦 Catálogo` para que la lista desplegable reemplace directamente el campo de entrada. Además, cuenta con el botón `💾 Guardar` para agregar materiales manuales al catálogo inmediatamente sin salir de la cotización; si el material ya existe en el catálogo, lo detecta y lo vincula automáticamente.
- **Guardado rápido de clientes**: En la sección de datos del destinatario, un botón dedicado permite guardar al cliente manual en el directorio maestro y seleccionarlo al instante sin duplicar si ya existe.
- **Trazabilidad visual de cotizaciones duplicadas**:
  - Al abrir una cotización duplicada (o llegar vía redirección tras pulsar "Duplicar"), el encabezado muestra un badge distintivo: `📑 Copia de COT-YYYY-XXXX`.
  - Despliega un mensaje flash informativo notificando que se trata de un nuevo folio listo para modificar.
- **Tiempo de entrega con calendario y días hábiles**:
  - Selector de fechas Desde/Hasta tipo `date` vinculado al texto de `tiempoEntrega`.
  - Calcula automáticamente días hábiles de **Lunes a Sábado** (omitiendo Domingos).
  - Regla de fin de semana: Si se cotiza en Viernes, Sábado o Domingo, el día hábil 1 es el Lunes.
  - Genera y actualiza dinámicamente rangos como `2 a 5 días hábiles` o `3 a 5 días hábiles`, permitiendo edición manual si se requiere.
- **Cálculo reactivo en tiempo real**: Al escribir en cantidad, precio, descuento o porcentajes de impuestos, recalcula instantáneamente Subtotal, Descuento Cliente, IVA, Retención en la fuente (Retefuente), Retención de Industria y Comercio (ReteICA), Anticipo (50%), Saldo (50%) y Gran Total.
- **Control limpio de impuestos y retenciones**: Al desmarcar los checkboxes de IVA, Retefuente o ReteICA, únicamente la fila desactivada se atenúa suavemente (`.totales__fila--desactivada`), sin tachar con línea ni distorsionar los subtotales, anticipos ni el total final.
- **Condiciones comerciales automáticas (50/50)**: En la sección de condiciones y entrega, una tarjeta informativa visual muestra en tiempo real los valores en pesos calculados para el 50% de anticipo y 50% de saldo contra entrega, sin necesidad de redactar textos a mano.
- **Detección automática de cliente**: Al seleccionar un cliente en el dropdown, autocompleta nombre, empresa, teléfono, email, dirección, NIT y Tipo de cliente, y aplica el porcentaje de descuento configurado.
- **Valores por defecto de impuestos**: Carga automáticamente el IVA, Retefuente (2.5%) y ReteICA (0.69%) configurados en los parámetros globales del sistema.
- **Acciones integradas**:
  - **Guardar y Descargar**: Persiste en backend, compila el PDF vectorial, lo envía al backend para respaldo y desencadena la descarga en el navegador.
  - **Reimprimir**: Vuelve a compilar el PDF de la cotización actual.
  - **Despacho Inteligente por WhatsApp**:
    - Genera y descarga de inmediato el archivo PDF en el equipo local.
    - Abre el modal de selección de destino que analiza si el teléfono del cliente es celular o fijo.
    - Si el cliente tiene un número fijo o no tiene teléfono, activa una alerta y selecciona automáticamente el WhatsApp de la Empresa / Remitente (`(+57) 314 375 4285`) para enviarse una copia de respaldo en su propio teléfono.
    - Permite alternar entre Celular del Cliente, WhatsApp Empresa (Copia) o Celular Manual, y adapta el mensaje automáticamente.
  - **Email**: Genera el PDF en memoria y lo envía por SMTP al correo del cliente.
