# 06 - Guía de Despliegue y Replicación para Agentes de IA

Esta guía paso a paso permite a un Agente de IA o desarrollador reconstruir, poner en marcha y verificar de forma 100% autónoma el sistema **Cotizador**.

---

## 📋 Requisitos Previos

- **Node.js**: Versión 18.x o superior.
- **NPM**: Gestor de paquetes incluido con Node.
- **Navegador Web**: Cualquier navegador moderno con soporte para ES6 modules y Canvas/Fetch.

---

## ⚙️ Paso a Paso para la Replicación

### Paso 1: Inicialización y Dependencias
Crear el archivo `package.json` e instalar las dependencias requeridas:

```bash
npm init -y
npm install express cors uuid nodemailer
```

### Paso 2: Estructura de Directorios
Crear el árbol de carpetas del proyecto:

```bash
mkdir -p json pdf respaldos public/css public/fonts public/image public/js
```

### Paso 3: Recursos Estáticos y Tipografías
1. Colocar las fuentes TrueType en `public/fonts/`:
   - `Roboto-Regular.ttf`
   - `Roboto-Bold.ttf`
2. Colocar los recursos gráficos en `public/image/`:
   - `logo.jpeg` (Logo institucional cuadrado o rectangular)
   - `favicon.svg`

### Paso 4: Creación del Servidor Backend (`server.js`)
Implementar el servidor Express con:
- Servido estático de `/public` y `/pdf`.
- Creación automática de directorios (`json`, `pdf`, `respaldos`) y archivos base en caso de no existir.
- Implementación de escrituras atómicas con `.tmp` y `fs.renameSync`.
- Endpoints REST para cotizaciones, clientes, productos, descuentos, configuración, respaldos, correo y PDFs.

### Paso 5: Implementación de la Interfaz Web y Controladores
1. Construir las hojas de estilo modulares (`variables.css`, `normalize.css`, `base.css`, `layout.css`, `components.css`).
2. Implementar los módulos base: `api.js`, `ui.js`, `pdf.js`.
3. Implementar las vistas HTML y sus respectivos controladores JS:
   - `dashboard.html` + `dashboard.js`
   - `cotizacion.html` + `cotizacion.js`
   - `productos.html` + `productos.js`
   - `clientes.html` + `clientes.js`
   - `descuentos.html` + `descuentos.js`
   - `configuracion.html` + `configuracion.js`

### Paso 6: Ejecución del Sistema y Acceso en Red Local
Iniciar el servidor:

```bash
node server.js
```

O haciendo doble clic en `Iniciar_Cotizador.bat`.

- **Acceso Local (en el mismo equipo)**: `http://localhost:3000`
- **Acceso en Red Local (LAN / Wi-Fi)**: `http://<IP_SERVIDOR>:3000` (el servidor detecta y muestra automáticamente todas las IPs activas en consola al arrancar).

### Paso 7: Configuración de Firewall para Acceso Multi-equipo
Para permitir que otros computadores o dispositivos móviles en la misma red local accedan al servidor, abrir el puerto 3000 TCP en el Firewall de Windows:

```cmd
netsh advfirewall firewall add rule name="Cotizador Servidor (Puerto 3000)" dir=in action=allow protocol=TCP localport=3000
```

*(Consulte `GUIA_INSTALACION_RED.md` para la guía completa de entrega, asignación de IP fija e inicio automático con Windows).*

---

## 🧪 Matriz de Verificación y Pruebas

Para validar que la réplica funciona correctamente, ejecutar las siguientes pruebas de verificación:

| Prueba | Acción | Resultado Esperado |
| :--- | :--- | :--- |
| **1. Inicialización de Almacén** | Iniciar servidor con carpeta `json/` vacía. | El servidor crea automáticamente los 5 archivos JSON válidos (`[]` y `{}`). |
| **2. Creación de Cliente** | Crear un cliente "Constructora Bolívar". | Código 201, asigna UUID y persiste en `clientes.json`. |
| **3. Creación de Producto** | Intentar crear con precio 0 (rechazado con 400); crear con precio 5000, Stock: 10, Mínimo: 15. | Valida precio > 0, código 201 y aparece en `GET /api/inventario/alertas` como stock bajo. |
| **4. Regla de Descuento** | Asignar 10% de descuento al cliente creado. | Al seleccionar el cliente en `cotizacion.html`, el descuento del 10% se deduce del subtotal. |
| **5. Creación de Cotización** | Crear cotización con 2 productos en tabla de 5 columnas (sin unidad) + conmutar IVA y Retefuente. | Genera folio `COT-2026-0001`, desmarca impuestos atenuando la fila sin tachar el resto, actualiza en tiempo real la tarjeta de condiciones 50/50 y total final. |
| **6. Compilación de PDF** | Presionar "Guardar y Descargar PDF". | Genera el documento con membrete, logo, tipografía Roboto, etiquetas de descuento con holgura horizontal (112mm sin solapar), desglose explícito de Anticipo y Saldo (50%) y lo guarda en `/pdf/COT-2026-0001.pdf`. |
| **7. Paginación de PDF (6/12 y multi-página)** | Crear cotizaciones con 8 y 28 ítems. | Con 8 ítems llena 12 filas en pág. 1 y pasa totales a pág. 2; con 28 ítems distribuye en 3 páginas (12 por pág.) sin romperse. |
| **8. Duplicación y Anulación** | Duplicar una cotización y anular otra en el Dashboard. | La duplicada recibe nuevo folio y estado borrador; la anulada queda archivada sin borrarse. |
| **9. Respaldo Snapshot** | Ejecutar botón "Crear Respaldo" en configuración. | Crea archivo `respaldo-YYYY-MM-DD...json` en `/respaldos/` con todos los datos consolidados. |
| **10. Persistencia Atómica** | Realizar múltiples escrituras simultáneas en Windows. | No se producen corrupciones ni excepciones `EPERM` gracias a los reintentos automáticos. |
| **11. Acceso en Red Local** | Abrir `http://<IP_SERVIDOR>:3000` desde un dispositivo cliente en la misma LAN. | Carga la interfaz completa, permitiendo operar cotizaciones con sincronización inmediata. |
