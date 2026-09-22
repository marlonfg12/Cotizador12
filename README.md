# Cotizador — Depósito de Flejes San Martín

Aplicación web local para crear, guardar, editar, duplicar, anular e imprimir cotizaciones de materiales de construcción y ornamentación con cálculo de IVA, Retención en la fuente (Retefuente) y desglose 50/50 de anticipo y saldo.

> **Guía completa del proyecto** (descripción, diagramas, inicio y detención del servidor): ver [SERVIDOR.md](./SERVIDOR.md)  
> **Suite de especificaciones técnicas para desarrolladores e IA**: ver [specs/README.md](./specs/README.md)

---

## ⚡ Inicio Rápido en Windows (Sin Consola)

Haga doble clic en el archivo:
```
Iniciar_Cotizador.bat
```
El script verifica Node.js, instala dependencias si es la primera vez, inicia el servidor local y abre automáticamente su navegador en [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Inicio Manual por Terminal

### Requisitos
- [Node.js](https://nodejs.org/) (versión 18 o superior)

### Comandos
```bash
cd Cotizador
npm install
npm start
```
Abra el navegador en: [http://localhost:3000](http://localhost:3000)

---

## 📁 Estructura del Proyecto

```
Cotizador/
├── json/                 # Base de datos basada en archivos JSON
│   ├── cotizaciones.json # Historial de cotizaciones con versionado
│   ├── clientes.json     # Directorio de clientes frecuentes
│   ├── productos.json    # Catálogo de materiales y control de stock
│   ├── descuentos.json   # Reglas de descuento por cliente o producto
│   └── configuracion.json# Ajustes de empresa, WhatsApp, SMTP e impuestos
├── pdf/                  # Documentos PDF generados con membrete institucional
├── respaldos/            # Snapshots automáticos y manuales de la base de datos
├── public/               # Interfaz de usuario (HTML5, CSS3 modular, Vanilla JS)
├── specs/                # Suite de especificaciones técnicas y arquitectura
├── server.js             # Servidor Express.js con persistencia atómica
├── Iniciar_Cotizador.bat # Lanzador de un solo clic para Windows
└── package.json          # Dependencias y scripts de ejecución
```

---

## 🧭 Flujo de Uso

1. En la pantalla inicial pulse **Ingresar al cotizador**.
2. En el **Panel de ventas (Dashboard)** consulte métricas en vivo, alertas de stock bajo y busque por texto, fechas o estado (*Borrador, Enviada, Aprobada, Rechazada, Anulada*).
3. Use **+ Nueva cotización** para preparar un presupuesto:
   - Puede seleccionar un cliente/producto registrado o escribirlo a mano.
   - Tabla simplificada y ergonómica (sin columna innecesaria de "Unidad"), adaptada para ventas de materiales (flejes, varillas, perfiles).
   - Interruptores individuales para **IVA** y **Retención en la fuente (Retefuente)** con atenuación limpia de filas inactivas (sin tachar ni distorsionar los totales).
   - Los valores por defecto de IVA y Retefuente se configuran en el módulo de **Configuración**.
   - Tarjeta informativa automática con el cálculo en tiempo real del **50% de anticipo** (para iniciar fabricación) y **50% de saldo contra entrega**, eliminando la necesidad de redactar textos a mano.
4. Al pulsar **Guardar y descargar PDF**:
   - Se genera el documento vectorial membretado con logo institucional, tabla paginada y espaciado optimizado para evitar traslapes de texto en descuentos.
   - El cuadro de totales del PDF incluye explícitamente el desglose del **Anticipo (50%)** y **Saldo contra entrega (50%)**, y en la sección de Condiciones se plasman los montos exactos en pesos calculados.
   - Se descarga inmediatamente en el navegador y se guarda copia en la carpeta `pdf/`.
5. Opciones de despacho omnicanal:
   - **WhatsApp**: Abre el chat hacia el cliente con prefijo colombiano `57` y mensaje con folio y total.
   - **Correo SMTP**: Envía el correo con el PDF adjunto mediante transporte configurado.
6. En el Dashboard puede **Ver/Editar**, **Reimprimir**, **Abrir PDF**, **Duplicar** y **Anular** cotizaciones.
