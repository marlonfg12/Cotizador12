# 03 - Contratos y Especificación de la API REST

Todos los endpoints responden en formato JSON y siguen las convenciones REST estándar sobre `http://localhost:3000`.

---

## 📑 1. Módulo de Cotizaciones

### `GET /api/cotizaciones`
Retorna la lista completa de cotizaciones ordenadas descendentemente por fecha de actualización (`actualizadoEn` o `creadoEn`).
- **Respuesta 200 OK**: `Array<Cotizacion>`
- **Respuesta 500 Internal Server Error**: `{ "error": "No se pudieron leer las cotizaciones" }`

### `GET /api/cotizaciones/:id`
Busca y retorna una cotización por su identificador único UUID.
- **Parámetros**: `id` (UUID en URL)
- **Respuesta 200 OK**: Objeto `Cotizacion`
- **Respuesta 404 Not Found**: `{ "error": "Cotización no encontrada" }`

### `POST /api/cotizaciones`
Crea una nueva cotización. Asigna automáticamente un `id` (UUID v4), genera el `folio` secuencial, establece `version: 1`, `estado: 'borrador'` (si no viene definido) y marca `creadoEn` y `actualizadoEn`.
- **Validaciones**: `req.body.destinatario.nombre` es obligatorio.
- **Body Requerido**: Objeto cotización (ver modelo `Cotizacion`).
- **Respuesta 201 Created**: Objeto `Cotizacion` creado.
- **Respuesta 400 Bad Request**: `{ "error": "El nombre del destinatario es obligatorio" }`

### `PUT /api/cotizaciones/:id`
Actualiza una cotización existente. Conserva inmutables el `id`, `folio` y `creadoEn`, incrementa la `version` en `+1` y actualiza `actualizadoEn`.
- **Parámetros**: `id` (UUID en URL)
- **Body**: Campos actualizados de la cotización.
- **Respuesta 200 OK**: Objeto `Cotizacion` actualizado.
- **Respuesta 404 Not Found**: `{ "error": "Cotización no encontrada" }`

### `DELETE /api/cotizaciones/:id`
Marca una cotización como anulada (soft-delete) en lugar de eliminarla físicamente. El campo `estado` se establece a `'anulada'` y la cotización se oculta por defecto en el dashboard.
- **Parámetros**: `id` (UUID en URL)
- **Respuesta 200 OK**: `{ "ok": true }`
- **Respuesta 404 Not Found**: `{ "error": "Cotización no encontrada" }`

### `POST /api/cotizaciones/:id/duplicar`
Crea una copia exacta de una cotización existente. La copia recibe un nuevo `id` (UUID v4), nuevo `folio` secuencial, `duplicadaDeFolio: origen.folio`, `duplicadaDeId: origen.id`, `version: 1`, `estado: 'borrador'`, `historialVersiones: []` y nuevos timestamps `creadoEn` y `actualizadoEn`.
- **Parámetros**: `id` (UUID de la cotización a duplicar, en URL)
- **Respuesta 201 Created**: Objeto `Cotizacion` duplicado con folio independiente y trazabilidad de origen.
- **Respuesta 404 Not Found**: `{ "error": "Cotización no encontrada" }`

---

## 👥 2. Módulo de Clientes

### `GET /api/clientes`
Retorna la lista completa de clientes.
- **Respuesta 200 OK**: `Array<Cliente>`

### `POST /api/clientes`
Registra un nuevo cliente con `id` (UUID v4) y timestamp `creadoEn`.
- **Validaciones**:
  - `req.body.nombre` es obligatorio y no vacío.
  - Validación de duplicados por nombre (`normalizarTexto(nombre)`): Rechaza con HTTP 400 si ya existe un cliente con nombre idéntico ignorando mayúsculas, tildes o espacios redundantes.
  - Validación de duplicados por NIT (`normalizarDoc(nit)`): Rechaza con HTTP 400 si ya existe un cliente con el mismo NIT/Cédula sin importar formato de puntos o guiones.
- **Respuesta 201 Created**: Objeto `Cliente` creado.
- **Respuesta 400 Bad Request**: `{ "error": "Ya existe un cliente registrado con el nombre/NIT..." }`

### `PUT /api/clientes/:id`
Actualiza los datos de un cliente existente con validación de duplicados excluyendo el ID actual.
- **Respuesta 200 OK**: Objeto `Cliente` actualizado.
- **Respuesta 400 Bad Request**: Si colisiona con otro cliente registrado.
- **Respuesta 404 Not Found**: `{ "error": "Cliente no encontrado" }`

### `DELETE /api/clientes/:id`
Elimina un cliente por su ID.
- **Respuesta 200 OK**: `{ "ok": true }`

---

## 📦 3. Módulo de Productos e Inventario

### `GET /api/productos`
Retorna el catálogo completo de productos.
- **Respuesta 200 OK**: `Array<Producto>`

### `POST /api/productos`
Crea un nuevo producto en el catálogo.
- **Validaciones**:
  - `req.body.nombre` es obligatorio y no vacío.
  - Validación de duplicados (`normalizarTexto(nombre)`): Rechaza con HTTP 400 si ya existe un producto con nombre idéntico (ej. bloquea `VARILLA  corrugada 5/8 DIACO` si existe `varilla corrugada 5/8 diaco`), permitiendo diferenciaciones semánticas válidas como `varilla 3/4` y `fleje 3/4`.
  - `req.body.precio` es obligatorio y debe ser un número estrictamente mayor a 0 (`precio > 0`). Se rechazan valores en 0 o negativos.
  - `stockActual` y `stockMinimo` deben ser números mayores o iguales a 0 (`>= 0`).
- **Respuesta 201 Created**: Objeto `Producto` creado.
- **Respuesta 400 Bad Request**:
  - `{ "error": "Ya existe un producto registrado en el catálogo con el nombre '...'." }`
  - `{ "error": "El precio unitario debe ser mayor a 0 (no se permiten valores en 0 ni negativos)" }`

### `PUT /api/productos/:id`
Actualiza datos de catálogo o existencias de stock de un producto con verificación de duplicados de nombre excluyendo el ID en edición.
- **Validaciones**:
  - Si se envía `nombre`, no puede colisionar con otro producto del catálogo.
  - Si se envía `precio`, debe ser mayor a 0 (`precio > 0`).
  - Si se envía `stockActual` o `stockMinimo`, no pueden ser negativos (`>= 0`).
- **Respuesta 200 OK**: Objeto `Producto` actualizado.
- **Respuesta 400 Bad Request**: En caso de violar las restricciones numéricas o de duplicidad.
- **Respuesta 404 Not Found**: `{ "error": "Producto no encontrado" }`

### `DELETE /api/productos/:id`
Elimina un producto del catálogo.
- **Respuesta 200 OK**: `{ "ok": true }`

### `GET /api/inventario/alertas`
Retorna la lista de productos cuyo `stockActual` es menor o igual a su `stockMinimo`.
- **Respuesta 200 OK**:
```json
[
  {
    "id": "uuid",
    "nombre": "Fleje 1/4 15x15",
    "stockActual": 5,
    "stockMinimo": 20,
    "unidad": "pza"
  }
]
```

---

## 🏷️ 4. Módulo de Descuentos

### `GET /api/descuentos`
Retorna el arreglo completo de reglas de descuento.
- **Respuesta 200 OK**: `Array<ReglaDescuento>`

### `PUT /api/descuentos`
Reemplaza y guarda la lista completa de reglas de descuento validadas (rango 0 a 100, tipos permitidos: `'cliente'` | `'producto'`).
- **Body**: `Array<ReglaDescuento>`
- **Respuesta 200 OK**: `Array<ReglaDescuento>`

---

## 🔄 7. Características Avanzadas: Soft-Delete, Duplicación y Versionado

### Soft-Delete (Estado 'anulada')
Cuando se elimina una cotización mediante `DELETE /api/cotizaciones/:id`, el sistema no la remueve del archivo JSON. En su lugar, establece `estado: 'anulada'`. Las cotizaciones anuladas permanecen archivadas y:
- No aparecen en el dashboard por defecto (filtro oculta `estado='anulada'` cuando no hay filtro de estado activo).
- Pueden consultarse explícitamente si el usuario filtra por estado `'anulada'`.
- Se preserva la auditoría completa: todas sus versiones, items y metadatos quedan intactos.

### Duplicación (`POST /api/cotizaciones/:id/duplicar`)
Crea una copia exacta de una cotización con:
- **Nuevo `id`**: UUID v4 generado al momento.
- **Nuevo `folio`**: Secuencial siguiente según la regla de generación.
- **`version: 1`**: Reinicia desde 1 (no copia versiones).
- **`estado: 'borrador'`**: La copia es siempre borrador.
- **`historialVersiones: []`**: Historial vacío.
- **Nuevos timestamps**: `creadoEn` y `actualizadoEn` con la marca de tiempo actual.
- **Todos los demás campos**: Se copian exactamente (destinatario, items, totales, etc.).

### Historial de Versiones (`historialVersiones[]`)
Cada `PUT /api/cotizaciones/:id` captura un snapshot completo antes de actualizar:
- **Límite**: Máximo 20 versiones anteriores por cotización (FIFO: la más antigua se descarta cuando se alcanza el límite).
- **Cada snapshot contiene**: `{version, timestamp, datos}` donde `datos` es un snapshot completo de todos los campos de la cotización en ese momento.
- **Versión actual**: Siempre disponible como los campos normales del documento (no está en `historialVersiones`).

---

## ⚙️ 8. Configuración, Respaldos y Correo

### `GET /api/configuracion`
Retorna la configuración activa del sistema (empresa, whatsapp, correo, impuestos por defecto: `ivaPorcentajeDefault`, `aplicarIvaDefault`, `retefuentePorcentajeDefault`, `aplicarReteFuenteDefault`, `reteicaPorcentajeDefault`, `aplicarReteIcaDefault`). Oculta la contraseña SMTP reemplazándola por `"********"` si existe valor.
- **Respuesta 200 OK**: Objeto `ConfiguracionSistema`

### `PUT /api/configuracion`
Actualiza la configuración del sistema, incluyendo los porcentajes e interruptores por defecto de IVA, Retención en la fuente (Retefuente) y Retención de Industria y Comercio (ReteICA). Si la contraseña enviada es `"********"`, mantiene la contraseña previa almacenada sin sobreescribirla.
- **Body**: Objeto parcial o total de `ConfiguracionSistema`.
- **Respuesta 200 OK**: Configuración actualizada (con contraseña enmascarada).

### `POST /api/respaldos`
Genera un archivo snapshot en `/respaldos/` con el contenido consolidado de todas las colecciones (`cotizaciones`, `clientes`, `productos`, `descuentos`, `configuracion`) con timestamp en el nombre: `respaldo-YYYY-MM-DDTHH-mm-ss-SSSZ.json`.
- **Respuesta 201 Created**: `{ "ok": true, "archivo": "respaldo-2026-09-14T15-00-00-000Z.json" }`

### `POST /api/correo/enviar`
Despacha un correo electrónico usando el transporte SMTP configurado en el sistema con el archivo PDF adjunto.
- **Body**:
```json
{
  "destinatario": "cliente@ejemplo.com",
  "asunto": "Cotización COT-2026-0001",
  "mensaje": "Hola Juan, adjuntamos su cotización.",
  "pdfBase64": "data:application/pdf;base64,JVBERi0xLjc...",
  "nombreArchivo": "COT-2026-0001.pdf"
}
```
- **Respuesta 200 OK**: `{ "ok": true }`
- **Respuesta 400 Bad Request**: Si faltan campos o no está configurado el servidor SMTP.
- **Respuesta 500 Internal Server Error**: `{ "error": "No se pudo enviar el correo: [detalle]" }`

---

## 📄 6. Módulo de PDF y Archivos Estáticos

### `POST /api/pdf`
Recibe un archivo PDF en Base64 generado por el cliente, valida su cabecera binaria (`%PDF`), sanea el folio para evitar path traversal y lo guarda en el directorio `/pdf/` del servidor.
- **Body**:
```json
{
  "folio": "COT-2026-0001",
  "pdfBase64": "data:application/pdf;base64,JVBERi0xLjc..."
}
```
- **Validaciones**:
  - `folio` y `pdfBase64` obligatorios.
  - El buffer decodificado debe tener al menos 100 bytes y comenzar con los bytes mágicos `%PDF`.
  - El nombre del archivo se limpia con regex: `folio.replace(/[^\w\-]/g, '_') + '.pdf'`.
- **Respuesta 200 OK**:
```json
{
  "ok": true,
  "archivo": "COT-2026-0001.pdf",
  "ruta": "/pdf/COT-2026-0001.pdf",
  "bytes": 45120
}
```

### `GET /pdf/:archivo`
Sirve directamente los archivos PDF almacenados mediante `express.static(PDF_DIR)`.
