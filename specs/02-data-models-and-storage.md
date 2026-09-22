# 02 - Modelos de Datos y Esquemas de Persistencia

Toda la persistencia de datos reside en la carpeta `/json/`. Los archivos almacenan arreglos JSON (a excepción de `configuracion.json` que almacena un objeto único).

---

## 📄 1. Cotizaciones (`json/cotizaciones.json`)

Almacena la lista de cotizaciones emitidas, en borrador o archivadas/anuladas.

### Esquema TypeScript / JSON Schema

```typescript
interface Cotizacion {
  id: string;                      // UUID v4
  folio: string;                   // Formato: COT-YYYY-XXXX (ej: "COT-2026-0001")
  duplicadaDeFolio?: string;       // Folio de la cotización origen si proviene de una duplicación (ej: "COT-2026-0004")
  duplicadaDeId?: string;          // UUID de la cotización origen
  version: number;                 // Entero incremental (inicia en 1)
  estado: 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'anulada';
  creadoEn: string;                // ISO 8601 Timestamp (ej: "2026-09-14T15:30:00.000Z")
  actualizadoEn: string;           // ISO 8601 Timestamp
  vigenteHasta?: string;           // Formato YYYY-MM-DD
  
  destinatario: {
    nombre: string;                // Obligatorio
    empresa?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    nit?: string;                  // NIT o Documento de identidad
    tipoCliente?: 'persona' | 'empresa' | 'otros';
    clienteId?: string | null;     // UUID del cliente si proviene del directorio
  };

  servicio?: string;               // Ej: "Venta de Material de Construcción / Ornamentación"
  detalleServicio?: string;        // Descripción extendida opcional
  condiciones?: string;            // Texto multilínea con términos de pago
  metodosPago?: string;            // Texto multilínea con cuentas bancarias
  entregaDesde?: string;           // Fecha inicial estimada YYYY-MM-DD
  entregaHasta?: string;           // Fecha final estimada YYYY-MM-DD
  tiempoEntrega?: string;          // Texto dinámico en días hábiles (ej: "2 a 5 días hábiles")
  inicioProyecto?: string;         // Ej: "Una vez confirmado el anticipo"
  notas?: string;                  // Observaciones generales

  items: CotizacionItem[];

  descuentoClientePorcentaje: number; // Porcentaje aplicado al subtotal consolidado (0-100)
  descuentoCliente: number;           // Valor monetario descontado
  subtotal: number;                   // Subtotal base imponible (subtotalProductos - descuentoCliente)
  
  aplicarIVA: boolean;                // Flag para habilitar/deshabilitar IVA
  ivaPorcentaje: number;              // Porcentaje de impuesto (ej: 19)
  iva: number;                        // Valor monetario de IVA

  aplicarReteFuente: boolean;         // Flag para habilitar/deshabilitar Retefuente
  retefuentePorcentaje: number;       // Porcentaje de retención (ej: 4 o 2.5)
  retefuente: number;                 // Valor monetario retenido en la fuente

  aplicarReteICA: boolean;            // Flag para habilitar/deshabilitar ReteICA
  reteicaPorcentaje: number;          // Porcentaje de ReteICA (ej: 0.966, 0.414, 0.69, etc.)
  reteica: number;                    // Valor monetario retenido por ReteICA

  totalDespuesImpuestos: number;      // subtotal + iva - retefuente - reteica
  anticipo: number;                   // Anticipo inicial (50% institucional no editable)
  saldo: number;                      // Saldo contra entrega (50% institucional no editable)
  total: number;                      // Gran total a pagar (= totalDespuesImpuestos)
  
  historialVersiones?: Array<{        // Snapshots de versiones anteriores (máx 20)
    version: number;
    guardadoEn: string;               // Timestamp ISO 8601
    snapshot: Partial<Cotizacion>;    // Snapshot completo de todos los campos
  }>;
}

interface CotizacionItem {
  productoId?: string | null;     // UUID del producto si proviene del catálogo
  descripcion: string;            // Nombre/descripción del material (Obligatorio, ej: "Fleje de 30*30", "Varilla 1/2")
  cantidad: number;               // Decimal >= 0 (ej: 1100, 20)
  unidad?: string;                // Interno/compatibilidad (Default: "pza"). Omitido de la tabla UI y PDF para simplificar ventas de materiales de construcción.
  precioUnitario: number;         // Decimal >= 0
  descuentoPorcentaje: number;    // Descuento específico por línea (0-100)
}
```

> **Nota sobre `condiciones`**: El campo se autogestiona en la interfaz con los valores exactos en pesos calculados para el 50% de anticipo y 50% de saldo contra entrega. No requiere redacción manual por parte del usuario y se traslada de forma íntegra al documento PDF.


### Regla de Generación de Folios
El folio se autogenera mediante la función `nextFolio(cotizaciones)`:
1. Obtiene el año en curso: `const year = new Date().getFullYear();`
2. Prefijo base: `COT-${year}-`
3. Extrae los números secuenciales existentes que coincidan con el prefijo del año actual.
4. Calcula el número siguiente (`Math.max(...nums) + 1` o `1` si es la primera).
5. Aplica relleno con ceros a 4 dígitos: `${prefix}${String(next).padStart(4, '0')}` (Ej: `COT-2026-0001`).

---

## 👥 2. Clientes (`json/clientes.json`)

Directorio maestro de clientes para autocompletado de cotizaciones y reglas de descuento.

```typescript
interface Cliente {
  id: string;              // UUID v4
  nombre: string;          // Obligatorio (Nombre de contacto / Razón social)
  empresa?: string;        // Razón social o nombre comercial
  nit?: string;            // NIT / Cédula / RUT de facturación
  tipoCliente?: 'persona' | 'empresa' | 'otros'; // Clasificación tributaria
  telefono?: string;       // Teléfono de contacto
  email?: string;          // Correo para despacho automático
  direccion?: string;      // Dirección física de entrega / facturación
  creadoEn: string;        // ISO 8601 Timestamp
  actualizadoEn?: string;  // ISO 8601 Timestamp
}
```

### Reglas de Validación de Duplicados en Clientes
- **Normalización de Nombre**: Se aplica `normalizarTexto(nombre)` (insensible a mayúsculas, tildes y espacios múltiples). Si coincide con un cliente existente, se rechaza la creación/actualización con HTTP 400.
- **Normalización de NIT**: Se aplica `normalizarDoc(nit)` (eliminando puntos, guiones y espacios). Si el NIT coincide con otro cliente existente, se rechaza para evitar dobles registros de la misma entidad tributaria.

---

## 📦 3. Productos / Inventario (`json/productos.json`)

Catálogo de materiales y control básico de stock.

```typescript
interface Producto {
  id: string;              // UUID v4
  nombre: string;          // Obligatorio (Ej: "Fleje 1/4 15x15", "Varilla corrugada 5/8 diaco")
  descripcion?: string;    // Especificaciones técnicas
  unidad: string;          // Ej: "pza", "kg", "m", "tramo" (Default: "pza")
  precio: number;          // Precio unitario obligatorio (Estrictamente > 0, no se permiten ceros ni negativos)
  stockActual: number;     // Cantidad disponible en bodega (>= 0)
  stockMinimo: number;     // Umbral para disparo de alerta de reabastecimiento (>= 0)
  creadoEn: string;        // ISO 8601 Timestamp
  actualizadoEn?: string;  // ISO 8601 Timestamp
}
```

### Reglas de Validación de Duplicados en Productos
- **Normalización Estricta**: `normalizarTexto(nombre)` remueve mayúsculas, tildes y espacios redundantes.
- **Diferenciación Semántica**: Garantiza que productos distintos con medidas compartidas (*varilla 3/4* vs *fleje 3/4*) se registren sin colisión, mientras bloquea re-escrituras accidentales del mismo material (*Varilla Corrugada 5/8 DIACO* vs *varilla corrugada 5/8 diaco*).

---

## 🏷️ 4. Descuentos (`json/descuentos.json`)

Reglas de descuento automáticas aplicadas en la interfaz de cotización.

```typescript
interface ReglaDescuento {
  id: string;                      // UUID v4
  tipo: 'cliente' | 'producto';    // Tipo de entidad a la que aplica
  referenciaId: string;            // UUID del cliente o producto asociado
  porcentaje: number;              // Porcentaje de descuento (0 a 100)
}
```

- Si `tipo === 'cliente'`: Se aplica como un porcentaje de descuento global sobre el subtotal acumulado de productos.
- Si `tipo === 'producto'`: Se autocompleta en el campo de descuento por línea al seleccionar el producto en la tabla de cotización.

---

## ⚙️ 5. Configuración (`json/configuracion.json`)

Ajustes del sistema, plantilla de mensajería, impuestos y credenciales SMTP.

```typescript
interface ConfiguracionSistema {
  empresa: {
    nombre: string;                // Default: "Depósito de Flejes San Martín"
    telefono: string;              // Default: "(+57) 3143754285"
    email: string;                 // Default: "flejessanmarin@hotmail.com"
  };
  ivaPorcentajeDefault: number;    // Default: 19
  aplicarIvaDefault: boolean;      // Default: true
  retefuentePorcentajeDefault: number; // Default: 4
  aplicarReteFuenteDefault: boolean;   // Default: true
  reteicaPorcentajeDefault: number;    // Default: 0.966
  aplicarReteIcaDefault: boolean;      // Default: false
  whatsapp: {
    numero: string;                // Número de WhatsApp de atención
    mensaje: string;               // Plantilla con variables: {cliente}, {folio}, {total}
  };
  correo: {
    host: string;                  // Servidor SMTP (ej: "smtp.gmail.com", "smtp-mail.outlook.com")
    puerto: number;                // Puerto (ej: 587 o 465)
    seguro: boolean;               // true para SSL (465), false para STARTTLS (587)
    usuario: string;               // Usuario o correo SMTP
    contrasena: string;            // Contraseña de aplicación (oculta en respuestas GET como "********")
    remitente: string;             // Nombre o correo remitente
  };
}
```
