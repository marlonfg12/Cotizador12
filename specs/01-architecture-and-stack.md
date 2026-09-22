# 01 - Arquitectura y Stack Tecnológico

## 🏗️ Visión General de la Arquitectura

El sistema implementa una arquitectura cliente-servidor desacoplada y ligera, optimizada para ejecutarse localmente o en un servidor Node.js sin bases de datos externas.

```
+-------------------------------------------------------------------+
|                        Cliente Web (Navegador)                    |
|  +---------------------+  +------------------+  +---------------+  |
|  |   HTML5 Semántico   |  | CSS Modular      |  | Vanilla JS    |  |
|  |   (Vistas estáticas)|  | (Tokens/BEM)     |  | (ES6+ Helpers)|  |
|  +---------------------+  +------------------+  +---------------+  |
|         |                                              |          |
|         |                     +------------------------+          |
|         v                     v                                   |
|   jsPDF + AutoTable     Fetch API / REST                          |
|   (Render vectorial)          |                                   |
+-------------------------------|-----------------------------------+
                                | HTTP (JSON)
                                v
+-------------------------------------------------------------------+
|                        Servidor Backend (Node.js)                 |
|  +--------------------------------------------------------------+ |
|  | Express.js Server (Puerto 3000)                              | |
|  | - Middleware CORS                                            | |
|  | - Static Server (`/public`, `/pdf`)                         | |
|  | - REST API Endpoints                                         | |
|  | - Nodemailer SMTP Dispatcher                                 | |
|  +--------------------------------------------------------------+ |
|                                |                                  |
|                                v                                  |
|  +--------------------------------------------------------------+ |
|  | Capa de Persistencia Atómica (JSON Filesystem)               | |
|  | - /json/*.json  (Escritura atómica .tmp -> renameSync)       | |
|  | - /pdf/*.pdf    (Almacenamiento de binarios generados)       | |
|  | - /respaldos/*  (Snapshots consolidados con timestamp)       | |
|  +--------------------------------------------------------------+ |
+-------------------------------------------------------------------+
```

---

## 🛠️ Stack Tecnológico

### Backend
- **Entorno de ejecución**: Node.js (>= 18.x recomendado).
- **Framework web**: Express.js (`4.21.2`).
- **Gestión de CORS**: `cors` (`2.8.5`).
- **Generación de identificadores**: `uuid` (`11.1.0` - v4).
- **Transporte de correo**: `nodemailer` (`6.10.0`).
- **Persistencia**: Sistema de archivos nativo de Node (`fs`, `path`) con escrituras atómicas.

### Frontend
- **Estructura**: HTML5 semántico puro (sin preprocesadores ni motores de plantillas como EJS/Pug).
- **Estilos**: CSS3 modular con variables CSS (`custom properties`), metodología BEM y diseño responsivo sin frameworks (Bootstrap/Tailwind).
- **Lógica**: JavaScript Vanilla (ES6+) con arquitectura modular en el objeto global `window` (`Api`, `UI`, `PdfCotizacion`).
- **Motor de PDF**:
  - `jspdf` (`2.5.1`) via CDN cdnjs.
  - `jspdf-autotable` (`3.8.4`) via CDN cdnjs.
- **Tipografía vectorial**: Fuentes TrueType (`Roboto-Regular.ttf`, `Roboto-Bold.ttf`) embebidas en Base64 en tiempo de ejecución.

---

## 📁 Estructura de Directorios del Proyecto

```
Cotizador/
├── json/                          # Base de datos basada en archivos JSON
│   ├── clientes.json              # Directorio de clientes
│   ├── configuracion.json         # Configuración SMTP, WhatsApp y Empresa
│   ├── cotizaciones.json          # Historial de cotizaciones emitidas
│   ├── descuentos.json            # Reglas de descuento por cliente y producto
│   └── productos.json             # Catálogo de materiales e inventario
├── pdf/                           # Documentos PDF persistidos en el servidor
├── respaldos/                     # Copias de seguridad completas (JSON snapshots)
├── public/                        # Archivos estáticos servidos por Express
│   ├── css/                       # Hojas de estilo modulares
│   │   ├── base.css               # Reglas base y tipografía
│   │   ├── components.css         # Botones, tarjetas, formularios, tablas, modales
│   │   ├── layout.css             # Header, navegación, contenedor principal
│   │   ├── normalize.css          # Reseteo estándar de CSS
│   │   └── variables.css          # Paleta de colores, espaciados y radios
│   ├── fonts/                     # Fuentes vectoriales para jsPDF
│   │   ├── Roboto-Bold.ttf
│   │   └── Roboto-Regular.ttf
│   ├── image/                     # Recursos gráficos
│   │   ├── favicon.svg
│   │   └── logo.jpeg              # Logo corporativo para encabezados y PDF
│   ├── js/                        # Controladores y servicios cliente
│   │   ├── api.js                 # Cliente HTTP centralizado (fetch wrapper)
│   │   ├── clientes.js            # Controlador de gestión de clientes
│   │   ├── configuracion.js       # Controlador de ajustes de correo/WhatsApp
│   │   ├── cotizacion.js          # Controlador del formulario principal de cotización
│   │   ├── dashboard.js           # Listado, métricas y buscador de cotizaciones históricas
│   │   ├── descuentos.js          # Controlador de reglas de descuento
│   │   ├── productos.js           # Panel de catálogo y alertas de stock mínimo
│   │   ├── pdf.js                 # Motor de maquetación y generación vectorial PDF
│   │   └── ui.js                  # Utilidades de interfaz (mensajes flash, formato)
│   ├── index.html                 # Vista: Pantalla de bienvenida / Landing page
│   ├── dashboard.html             # Vista: Panel de ventas y lista de cotizaciones
│   ├── cotizacion.html            # Vista: Creador y editor de cotizaciones
│   ├── productos.html             # Vista: Gestión de productos e inventario
│   ├── clientes.html              # Vista: Directorio de clientes
│   ├── descuentos.html            # Vista: Configuración de descuentos
│   └── configuracion.html         # Vista: Ajustes del sistema y respaldos
├── specs/                         # Suite de especificaciones para Agentes de IA
│   ├── README.md
│   ├── 01-architecture-and-stack.md
│   ├── 02-data-models-and-storage.md
│   ├── 03-backend-api.md
│   ├── 04-frontend-and-ui.md
│   ├── 05-business-logic-and-pdf.md
│   └── 06-deployment-and-replication-guide.md
├── Iniciar_Cotizador.bat          # Lanzador de un clic para Windows (sin consola)
├── package.json                   # Definición del paquete y dependencias npm
├── server.js                      # Punto de entrada y servidor Express
└── CLAUDE.md                      # Instrucciones de entorno y agentes
```

---

## 🔒 Patrón de Persistencia Atómica

Para evitar la corrupción de datos ante cortes eléctricos o detenciones inesperadas del proceso Node.js, todas las mutaciones en disco siguen el patrón de escritura segura:

1. El archivo temporal se escribe en el mismo directorio con sufijo `.tmp`:
   `path/to/archivo.json.tmp`
2. Una vez completada la escritura en disco de forma síncrona, se ejecuta un renombrado atómico sobre el archivo definitivo:
   `fs.renameSync(tmpPath, filePath)`
3. Los sistemas de archivos POSIX y NTFS garantizan que `rename` sea una operación atómica a nivel de inodo/tabla de archivos.
