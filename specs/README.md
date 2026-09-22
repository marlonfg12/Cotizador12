# Especificación del Sistema - Cotizador Depósito de Flejes San Martín

Guía maestra y suite de especificaciones técnicas para la comprensión, mantenimiento y replicación autónoma del sistema por Agentes de IA e ingenieros de software.

---

## 📌 Propósito del Proyecto
El **Cotizador** es una aplicación web full-stack ligera, diseñada para gestionar cotizaciones comerciales, control de clientes, catálogo de productos con alertas de stock mínimo, reglas de descuentos automáticos (por cliente o por producto), generación de documentos PDF vectoriales membretados, y despacho omnicanal (WhatsApp Web y correo SMTP con adjuntos PDF).

---

## 📂 Estructura de las Especificaciones

La suite de documentación en `specs/` está dividida en 6 módulos exhaustivos:

| Archivo | Contenido Principal |
| :--- | :--- |
| [`01-architecture-and-stack.md`](./01-architecture-and-stack.md) | Arquitectura general, tecnologías, dependencias y estructura de directorios. |
| [`02-data-models-and-storage.md`](./02-data-models-and-storage.md) | Modelos de datos JSON, esquemas de persistencia, generación de folios e IDs. |
| [`03-backend-api.md`](./03-backend-api.md) | Contratos REST de todos los endpoints, códigos de estado, validaciones y errores. |
| [`04-frontend-and-ui.md`](./04-frontend-and-ui.md) | Vistas HTML, sistema de diseño CSS (tokens, layout, componentes) y controladores JS. |
| [`05-business-logic-and-pdf.md`](./05-business-logic-and-pdf.md) | Motor de cálculos financieros, generación vectorial de PDF con jsPDF y envíos. |
| [`06-deployment-and-replication-guide.md`](./06-deployment-and-replication-guide.md) | Guía paso a paso para que un agente de IA replique y verifique el proyecto desde cero. |

---

## 🤖 Instrucciones para Agentes de IA

Cuando un agente de IA deba reconstruir, extender o auditar este proyecto:
1. **Seguir el principio de simplicidad**: Sin frameworks frontend pesados (React/Vue/Angular) ni ORMs complejos. Se utiliza Vanilla JS (ES6+) en el frontend y Express.js con almacenamiento JSON atómico en el backend.
2. **Respetar la identidad visual y formatos**: Paleta institucional azul corporativo (`#0b234b`), fuente Roboto y formato de moneda colombiana `es-CO` (`$X.XXX`).
3. **Mantener integridad en los cálculos y ergonomía**:
   - Subtotal por producto con descuento por ítem en tabla ergonómica de 5 columnas (sin columna innecesaria de unidad).
   - Descuento general por cliente aplicado al subtotal consolidado.
   - IVA y Retención en la fuente (Retefuente) calculados sobre la base imponible neta con interruptores limpios.
   - Desglose institucional no editable de anticipo (50%) y saldo (50%) reflejado en tarjetas informativas automáticas y en el PDF con margen anti-traslapes (112mm).
4. **Persistencia atómica y respaldos**: Todas las escrituras en archivos JSON deben usar escritura temporal + renombrado atómico con reintentos para Windows (`fs.renameSync`). Respaldos automáticos diarios y por volumen en `/respaldos/`.
