# 05 - Lógica de Negocio y Generación de PDF

Este documento detalla los algoritmos matemáticos y las reglas de maquetación vectorial para replicar con exactitud el comportamiento del sistema.

---

## 💰 1. Motor de Cálculos Financieros

El cálculo de totales de una cotización sigue una jerarquía de cascada estricta:

```
[ Ítem 1: Cantidad * Precio * (1 - Desc% / 100) ]
                      +
[ Ítem 2: Cantidad * Precio * (1 - Desc% / 100) ]
                      +
[ Ítem N: Cantidad * Precio * (1 - Desc% / 100) ]
                      ||
                      \/
          [ Subtotal de Productos ]
                      -
  [ Descuento Cliente: Subtotal * (DescCliente% / 100) ]
                      ||
                      \/
              [ Subtotal Neto ]
                      +
        [ IVA: Subtotal Neto * (IVA% / 100) ]
                      -
 [ Retefuente: Subtotal Neto * (Retefuente% / 100) ]
                      -
    [ ReteICA: Subtotal Neto * (ReteICA% / 100) ]
                      ||
                      \/
         [ Total Después de Impuestos ]
                      ├──► [ Anticipo: Total * 0.5 (Fijo) ]
                      └──► [ Saldo: Total * 0.5 (Fijo) ]
```

### Fórmulas Matemáticas

1. **Importe por Producto (Línea de Cotización)**:
   $$\text{importe\_item} = \text{cantidad} \times \text{precioUnitario} \times \left(1 - \frac{\text{descuentoPorcentaje}}{100}\right)$$

2. **Subtotal de Productos**:
   $$\text{subtotalProductos} = \sum_{i=1}^{n} \text{importe\_item}_i$$

3. **Descuento Global por Cliente**:
   $$\text{descuentoCliente} = \text{subtotalProductos} \times \left(\frac{\text{descuentoClientePorcentaje}}{100}\right)$$

4. **Subtotal Base Imponible**:
   $$\text{subtotal} = \text{subtotalProductos} - \text{descuentoCliente}$$

5. **Impuesto al Valor Agregado (IVA)**:
   $$\text{iva} = \begin{cases} \text{subtotal} \times \left(\frac{\text{ivaPorcentaje}}{100}\right) & \text{si aplicarIVA es true} \\ 0 & \text{si aplicarIVA es false} \end{cases}$$

6. **Retención en la Fuente (Retefuente)**:
   $$\text{retefuente} = \begin{cases} \text{subtotal} \times \left(\frac{\text{retefuentePorcentaje}}{100}\right) & \text{si aplicarReteFuente es true} \\ 0 & \text{si aplicarReteFuente es false} \end{cases}$$

7. **Retención de Industria y Comercio (ReteICA)**:
   $$\text{reteica} = \begin{cases} \text{subtotal} \times \left(\frac{\text{reteicaPorcentaje}}{100}\right) & \text{si aplicarReteICA es true} \\ 0 & \text{si aplicarReteICA es false} \end{cases}$$

8. **Total a Pagar (Total después de impuestos)**:
   $$\text{total} = \text{subtotal} + \text{iva} - \text{retefuente} - \text{reteica}$$

9. **Desglose de Pago (Condición institucional 50/50 no editable)**:
   $$\text{anticipo} = \text{total} \times 0.5$$
   $$\text{saldo} = \text{total} \times 0.5$$

10. **Tiempo de Entrega y Días Hábiles (Lunes a Sábado)**:
    - **Jornada Hábil**: Lunes a Sábado. Los Domingos quedan estrictamente excluidos.
    - **Regla de Cotización en Fin de Semana**: Si la cotización se emite un Viernes, Sábado o Domingo, el primer día hábil de producción arranca el Lunes siguiente.
    - **Rango por Defecto**: Día hábil 2 al día hábil 5 (ej. `2 a 5 días hábiles`).
    - **Recálculo Reactivo por Calendario**: Si el usuario selecciona fechas específicas en el calendario (ej. día 3 al día 5), el texto se recalcula automáticamente a `3 a 5 días hábiles` y se plasma de forma fiel en la cotización y en el PDF.

---

## 📄 2. Generación Vectorial de PDF (`public/js/pdf.js`)

El documento PDF se construye en el cliente utilizando la biblioteca `jsPDF` con la extensión `jspdf-autotable`.

### Parámetros de Página y Dimensiones
- **Formato**: A4 vertical (`210mm x 297mm`).
- **Márgenes**: `18mm` laterales y superior, `27mm` margen inferior de seguridad.
- **Línea de Pie de Página (`PIE_Y`)**: `277mm`.
- **Ancho Útil**: $210 - (18 \times 2) = 174\text{ mm}$.

### Tipografías y Recursos Embebidos
1. **Fuentes TrueType**: Se cargan por `fetch('/fonts/Roboto-Regular.ttf')` y `fetch('/fonts/Roboto-Bold.ttf')`, se convierten a Base64 mediante `arrayBufferToBase64()` y se registran en el Virtual File System (VFS) de jsPDF:
   - `doc.addFileToVFS('Roboto-Regular.ttf', regularB64);`
   - `doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');`
   - `doc.addFileToVFS('Roboto-Bold.ttf', boldB64);`
   - `doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');`
   - Si la carga por fetch falla (ej. problemas de caché), el sistema recurre automáticamente a la fuente del sistema `Helvetica` sin interrumpir la generación.
2. **Logo Corporativo**: Se descarga de `/image/logo.jpeg`, se convierte a DataURI Base64 y se dibuja con `doc.addImage(...)`.

### Reglas de Paginación y Chunking (Lógica 6 / 12 Filas)
- **Caso 1 (1 a 6 productos)**:
  - Todo el contenido cabe en **1 sola página**.
  - Página 1: Encabezado completo + Tabla de 6 filas (rellenada hasta 6 filas vacías) + Cuadro de Totales y Condiciones.
- **Caso 2 (7 a 12 productos)**:
  - Genera **2 páginas** sin dejar huecos en blanco:
    - **Página 1**: Se agregan 6 filas a la capacidad para totalizar **12 filas**. Todos los productos se presentan en la primera página (rellenada visualmente a 12 filas).
    - **Página 2**: Las filas de productos no continúan (no superaron 12). Se pasa toda la parte de subtotales, impuestos, anticipo/saldo y condiciones a la página 2 con subtítulo *"Condiciones y resumen comercial"*.
- **Caso 3 (Más de 12 productos)**:
  - Soporta **múltiples páginas** (3, 4, 5... sin romperse):
    - **Página 1**: Primeros 12 productos en tabla completa de 12 filas.
    - **Páginas intermedias**: Bloques de hasta 12 productos por página con encabezado de continuación.
    - **Última página**: Productos restantes (rellenada a 6 filas mínimo) + Cuadro de Totales y Condiciones comerciales. Si el espacio vertical no fuese suficiente por notas extensas, traslada automáticamente los totales a una página de cierre adicional.
- **Relleno visual**: Cada página ajusta su relleno (`minFilas = 12` en páginas completas, `minFilas = 6` en páginas compartidas con totales) para garantizar un diseño simétrico y profesional.

### Estructura de Encabezados
- **Primera Página (`dibujarEncabezadoCompleto`)**:
  - Título "Cotización" (30pt, Azul `#0b234b`).
  - Logo corporativo (35x35mm) en esquina superior derecha.
  - Número de cotización y fecha larga formateada en español (ej: `14 de septiembre del 2026`).
  - Datos completos del cliente: Nombre, NIT (si existe), Email, Teléfono, Empresa/Dirección.
  - Servicio principal y detalle del servicio (con salto de línea automático `splitTextToSize`).
- **Páginas de Continuación (`dibujarEncabezadoContinuacion`)**:
  - Título "Cotización" compacto (22pt).
  - Logo compacto (18x18mm).
  - Número de cotización y texto secundario "Continuación de productos".

### Cuadro de Totales y Condiciones (`dibujarTotalesYCondiciones`)
- **Alineación y Prevención de Traslapes**:
  - `xEtiquetas = 112mm` y `xValores = 192mm` (margen derecho).
  - Otorga 80mm de ancho libre para etiquetas extensas (ej. `Descuento cliente (15%)`), impidiendo colisiones visuales con las cifras monetarias alineadas a la derecha.
- **Columna Derecha (Totales)**:
  - Subtotal base imponible.
  - Descuento de cliente (si aplica `> 0`, con signo negativo `-$X.XXX`).
  - IVA con porcentaje indicado (si aplica y `> 0`).
  - Retención en la fuente (Retefuente) deducida con porcentaje (si aplica y `> 0`, con signo negativo `-$X.XXX`).
  - Retención de Industria y Comercio (ReteICA) deducida con porcentaje (si aplica y `> 0`, con signo negativo `-$X.XXX`).
  - Gran TOTAL resaltado en negrita de 14pt color azul corporativo.
  - **Desglose 50% institucional**:
    - `Anticipo (50%)` en verde éxito (`#1b7a3d`), monto exacto calculado.
    - `Saldo contra entrega (50%)` en gris corporativo, monto exacto restante.
- **Columna Izquierda (Condiciones)**:
  - Viñetas formateadas dinámicamente con los valores reales calculados en pesos:
    - `• Anticipo del 50% ($X.XXX.XXX): para iniciar fabricación / pedido`
    - `• Saldo del 50% ($X.XXX.XXX): contra entrega del material`
  - Métodos de pago y números de cuenta bancaria.
- **Columna Derecha (Logística)**:
  - Tiempo de entrega estimado.
  - Inicio del proyecto.
- **Sección de Notas**: Observaciones al pie si existen y hay espacio antes del margen de pie de página.
- **Salto automático**: Si el espacio vertical restante es menor a **85mm**, se agrega una nueva página para garantizar que los totales y condiciones no se solapen con el pie.

### Pie de Página Global (`dibujarPies`)
Se itera por todas las páginas generadas aplicando:
- Línea horizontal divisoria azul (`#0b234b`, grosor `0.6mm`).
- Razón social: "Depósito de Flejes San Martín".
- Teléfono de contacto centrado: "(+57) 3143754285".
- Correo a la derecha: "flejessanmarin@hotmail.com".
- Slogan: "Hierro figurado para la construcción".
- Numeración de página: "Página X de Y".

---

## 🚀 3. Flujo de Despacho y Persistencia
 
 1. **Almacenamiento Local y Descarga de PDF**:
    - `doc.output('datauristring')` genera el binario en Base64.
    - Se despacha vía `POST /api/pdf` para archivado en `/pdf/{folio}.pdf`.
    - Se activa la descarga directa en el navegador mediante `doc.save('{folio}.pdf')`.
 2. **Despacho Inteligente por WhatsApp con Descarga Previa y Respaldo**:
    - **Descarga Inmediata**: Al pulsar "Enviar por WhatsApp", compila y descarga automáticamente el PDF de la cotización en la computadora del usuario.
    - **Análisis de Línea Móvil vs Fija**:
      - Si el teléfono del cliente es celular colombiano válido (10 dígitos arrancando en `3`), lo selecciona y formatea con prefijo `57`.
      - Si el teléfono es fijo (ej. 7 dígitos `5405546`) o no existe, muestra una alerta y activa por defecto el **WhatsApp de la Empresa / Remitente** (`(+57) 314 375 4285`) para recibir la copia del documento en su propio teléfono móvil.
    - **Plantilla Dinámica**:
      - Si es para el cliente: Saludo, folio, total, anticipo (50%), saldo (50%) y tiempo de entrega.
      - Si es copia para la empresa: Folio, cliente, empresa/obra, teléfono de contacto, total, anticipo, saldo y tiempo de entrega.
    - Abre `https://wa.me/{numero}?text={mensajeUrlEncoded}`.
 3. **Despacho por Correo SMTP**:
    - Genera el PDF en memoria.
    - Envía payload al endpoint `POST /api/correo/enviar`.
    - El backend utiliza Nodemailer con autenticación SMTP y timeouts de seguridad para enviar el correo con el archivo PDF adjunto.
 
 4. **Flujo de Duplicación y Modificación Inmediata**:
    - Al pulsar "Duplicar" en el Dashboard, el backend crea la copia independiente asignándole su propio `folio` y marcando `duplicadaDeFolio: origen.folio`.
    - El frontend redirige automáticamente al formulario `/cotizacion.html?id={id}&duplicada=1`.
    - La vista de edición despliega un badge visual de advertencia `📑 Copia de COT-YYYY-XXXX` en el encabezado y una notificación informativa para que el usuario diferencie de forma inequívoca la cotización recién duplicada y realice sus cambios de inmediato.
