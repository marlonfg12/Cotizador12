/**
 * ==============================================================================
 * GENERADOR VECTORIAL DE COTIZACIONES EN PDF (PdfCotizacion)
 * ==============================================================================
 * Maquetación profesional de alta fidelidad con jsPDF:
 * - Formato A4 vertical (210 x 297 mm) con márgenes de 18 mm y pie en Y=277 mm.
 * - Fuentes TrueType Roboto embebidas con fallback a Helvetica.
 * - Paginación inteligente con soporte multi-página (lógica 6 / 12 filas).
 * - Alineación perfecta de totales (x=112 mm etiquetas, x=192 mm valores).
 * - Desglose explícito de anticipo (50%) y saldo (50%) en verde y gris.
 * - Almacenamiento en servidor (/api/pdf) y descarga directa.
 * ==============================================================================
 */

const PdfCotizacion = (() => {
  // Caché de recursos en memoria
  let logoBase64Cache = null;
  let fontRegularB64Cache = null;
  let fontBoldB64Cache = null;

  /**
   * Convierte ArrayBuffer a Base64
   */
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Carga una imagen y la convierte a DataURI Base64
   */
  async function cargarImagenBase64(url) {
    if (logoBase64Cache) return logoBase64Cache;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          logoBase64Cache = reader.result;
          resolve(reader.result);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  /**
   * Carga y embebe fuentes TrueType Roboto en el VFS de jsPDF
   */
  async function registrarFuentes(doc) {
    try {
      if (!fontRegularB64Cache) {
        const resReg = await fetch('/fonts/Roboto-Regular.ttf');
        if (resReg.ok) {
          const bufReg = await resReg.arrayBuffer();
          fontRegularB64Cache = arrayBufferToBase64(bufReg);
        }
      }
      if (!fontBoldB64Cache) {
        const resBold = await fetch('/fonts/Roboto-Bold.ttf');
        if (resBold.ok) {
          const bufBold = await resBold.arrayBuffer();
          fontBoldB64Cache = arrayBufferToBase64(bufBold);
        }
      }

      if (fontRegularB64Cache && fontBoldB64Cache) {
        doc.addFileToVFS('Roboto-Regular.ttf', fontRegularB64Cache);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

        doc.addFileToVFS('Roboto-Bold.ttf', fontBoldB64Cache);
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

        doc.setFont('Roboto', 'normal');
        return 'Roboto';
      }
    } catch (e) {
      console.warn('Fallback a Helvetica por fallo de fuentes:', e);
    }
    doc.setFont('Helvetica', 'normal');
    return 'Helvetica';
  }

  /**
   * Formatea un número como moneda colombiana ($ 1.250.000)
   */
  function formatoMoneda(valor) {
    const num = Math.round(Number(valor) || 0);
    return '$ ' + num.toLocaleString('es-CO');
  }

  /**
   * Formatea una fecha ISO a texto largo en español
   */
  function formatoFechaLarga(isoDate) {
    try {
      const d = isoDate ? new Date(isoDate) : new Date();
      const meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      return `${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
    } catch {
      return 'Fecha actual';
    }
  }

  /**
   * Dibuja el encabezado completo de la primera página
   */
  function dibujarEncabezadoCompleto(doc, data, logoData, fontFam) {
    const xMargen = 18;
    let y = 20;

    // 1. Título "Cotización"
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(26);
    doc.setTextColor(11, 35, 75); // Azul #0b234b
    doc.text('Cotización', xMargen, y);

    // 2. Logo corporativo a la derecha
    if (logoData) {
      try {
        doc.addImage(logoData, 'JPEG', 157, 14, 35, 35);
      } catch (err) {
        console.warn('Error dibujando logo:', err);
      }
    }

    // 3. Folio y Fecha
    y += 7;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(11, 35, 75);
    const folio = data.folio || 'COT-2026-0001';
    doc.text(`No. ${folio}`, xMargen, y);

    doc.setFont(fontFam, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(` · ${formatoFechaLarga(data.creadoEn)}`, xMargen + doc.getTextWidth(`No. ${folio}`), y);

    // 4. Datos del Cliente / Destinatario
    y += 10;
    const d = data.destinatario || {};
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('DIRIGIDO A:', xMargen, y);

    y += 5;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(d.nombre || 'Cliente general', xMargen, y);

    y += 4.5;
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    if (d.empresa) {
      doc.text(`Empresa / Obra: ${d.empresa}`, xMargen, y);
      y += 4;
    }
    if (d.nit) {
      doc.text(`NIT / Cédula: ${d.nit}`, xMargen, y);
      y += 4;
    }
    const contacto = [d.telefono ? `Tel: ${d.telefono}` : '', d.email ? `Email: ${d.email}` : '']
      .filter(Boolean)
      .join('  |  ');
    if (contacto) {
      doc.text(contacto, xMargen, y);
      y += 4;
    }
    if (d.direccion) {
      doc.text(`Dirección: ${d.direccion}`, xMargen, y);
      y += 4;
    }

    // 5. Servicio / Objeto
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(xMargen, y, 192, y);

    y += 5;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(11, 35, 75);
    doc.text(`Servicio: ${data.servicio || 'Venta de Material de Construcción / Ornamentación'}`, xMargen, y);

    if (data.detalleServicio) {
      y += 4;
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const lineasDetalle = doc.splitTextToSize(data.detalleServicio, 174);
      doc.text(lineasDetalle, xMargen, y);
      y += (lineasDetalle.length * 3.8);
    }

    return y + 4;
  }

  /**
   * Dibuja encabezado compacto en páginas de continuación
   */
  function dibujarEncabezadoContinuacion(doc, data, logoData, fontFam) {
    const xMargen = 18;
    let y = 18;

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(11, 35, 75);
    doc.text('Cotización', xMargen, y);

    if (logoData) {
      try {
        doc.addImage(logoData, 'JPEG', 174, 12, 18, 18);
      } catch {}
    }

    y += 5;
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`No. ${data.folio || ''} (Continuación de productos)`, xMargen, y);

    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(xMargen, y, 192, y);

    return y + 6;
  }

  /**
   * Dibuja la tabla vectorial de productos con relleno simétrico
   */
  function dibujarTablaProductos(doc, itemsPagina, startY, fontFam, totalFilasEsperadas = 6) {
    const xMargen = 18;
    const anchoTotal = 174;
    const colAnchos = {
      desc: 94,
      cant: 22,
      precio: 29,
      total: 29,
    };

    let y = startY;

    // Encabezado de la tabla
    doc.setFillColor(11, 35, 75); // Azul rey oscuro
    doc.rect(xMargen, y, anchoTotal, 7.5, 'F');

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);

    doc.text('DESCRIPCIÓN / MATERIAL', xMargen + 3, y + 5);
    doc.text('CANT.', xMargen + colAnchos.desc + (colAnchos.cant / 2), y + 5, { align: 'center' });
    doc.text('UNITARIO', xMargen + colAnchos.desc + colAnchos.cant + colAnchos.precio - 3, y + 5, { align: 'right' });
    doc.text('IMPORTE', xMargen + anchoTotal - 3, y + 5, { align: 'right' });

    y += 7.5;

    const altoFila = 7;
    const totalFilas = Math.max(itemsPagina.length, totalFilasEsperadas);

    for (let i = 0; i < totalFilas; i++) {
      const item = itemsPagina[i];
      const esPar = i % 2 === 1;

      // Fondo alternado
      if (esPar) {
        doc.setFillColor(248, 250, 252);
        doc.rect(xMargen, y, anchoTotal, altoFila, 'F');
      }

      // Línea inferior suave
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(xMargen, y + altoFila, xMargen + anchoTotal, y + altoFila);

      if (item) {
        const cant = Number(item.cantidad) || 0;
        const precio = Number(item.precioUnitario) || 0;
        const descPct = Number(item.descuentoPorcentaje) || 0;
        const importe = cant * precio * (1 - descPct / 100);

        doc.setFont(fontFam, 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);

        // Descripción con truncado o ajuste
        const descTexto = item.descripcion || 'Material';
        const descCorta = doc.splitTextToSize(descTexto, colAnchos.desc - 6)[0] || descTexto;
        doc.text(descCorta, xMargen + 3, y + 4.8);

        // Cantidad
        doc.text(String(cant), xMargen + colAnchos.desc + (colAnchos.cant / 2), y + 4.8, { align: 'center' });

        // Precio Unitario
        doc.text(formatoMoneda(precio), xMargen + colAnchos.desc + colAnchos.cant + colAnchos.precio - 3, y + 4.8, { align: 'right' });

        // Total
        doc.setFont(fontFam, 'bold');
        doc.text(formatoMoneda(importe), xMargen + anchoTotal - 3, y + 4.8, { align: 'right' });
      }

      y += altoFila;
    }

    // Borde exterior de la tabla
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(xMargen, startY, anchoTotal, y - startY);

    return y + 6;
  }

  /**
   * Dibuja el cuadro consolidado de totales, impuestos, anticipo/saldo y condiciones
   */
  function dibujarTotalesYCondiciones(doc, data, startY, fontFam) {
    const xMargen = 18;
    let y = startY;

    // Si el espacio restante es muy corto, crear una página adicional limpia
    if (y > 195) {
      doc.addPage();
      y = 22;
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(12);
      doc.setTextColor(11, 35, 75);
      doc.text(`Condiciones y resumen comercial — ${data.folio || ''}`, xMargen, y);
      y += 8;
    }

    const yBase = y;

    // --------------------------------------------------------------------------
    // COLUMNA IZQUIERDA: CONDICIONES, LOGÍSTICA Y CUENTAS BANCARIAS
    // --------------------------------------------------------------------------
    let yIzq = yBase;
    const anchoIzq = 86;

    // 1. Desglose Institucional 50/50
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(xMargen, yIzq, anchoIzq, 24, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(xMargen, yIzq, anchoIzq, 24, 2, 2, 'D');

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 35, 75);
    doc.text('CONDICIONES DE PAGO (50% / 50%)', xMargen + 4, yIzq + 5.5);

    const anticipo = Number(data.anticipo) || (Number(data.total) || 0) * 0.5;
    const saldo = Number(data.saldo) || (Number(data.total) || 0) * 0.5;

    doc.setFont(fontFam, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(21, 100, 50);
    doc.text(`• Anticipo 50% (${formatoMoneda(anticipo)}): Para iniciar fabricación`, xMargen + 4, yIzq + 12);

    doc.setTextColor(71, 85, 105);
    doc.text(`• Saldo 50% (${formatoMoneda(saldo)}): Contra entrega del material`, xMargen + 4, yIzq + 18);

    yIzq += 28;

    // 2. Logística y Tiempos de Entrega
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 35, 75);
    doc.text('LOGÍSTICA Y ENTREGA', xMargen, yIzq);

    yIzq += 4.5;
    doc.setFont(fontFam, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const tiempoEntrega = data.tiempoEntrega || '2 a 5 días hábiles';
    doc.text(`• Tiempo de entrega: ${tiempoEntrega}`, xMargen, yIzq);

    yIzq += 4;
    const inicio = data.inicioProyecto || 'Una vez confirmado el anticipo';
    doc.text(`• Inicio: ${inicio}`, xMargen, yIzq);

    yIzq += 6;

    // 3. Cuentas y Métodos de Pago
    if (data.metodosPago) {
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(11, 35, 75);
      doc.text('MÉTODOS DE PAGO', xMargen, yIzq);

      yIzq += 4.5;
      doc.setFont(fontFam, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const lineasPago = doc.splitTextToSize(data.metodosPago, anchoIzq);
      doc.text(lineasPago, xMargen, yIzq);
      yIzq += (lineasPago.length * 3.6) + 3;
    }

    // --------------------------------------------------------------------------
    // COLUMNA DERECHA: TOTALES E IMPUESTOS
    // --------------------------------------------------------------------------
    let yDer = yBase;
    const xEtiquetas = 112; // 80mm libres de holgura
    const xValores = 192;   // Margen derecho alineado

    function filaTotal(etiqueta, valorStr, esNegrita = false, colorRgb = [30, 41, 59], fontSize = 8.5) {
      doc.setFont(fontFam, esNegrita ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
      doc.text(etiqueta, xEtiquetas, yDer);
      doc.text(valorStr, xValores, yDer, { align: 'right' });
      yDer += 5;
    }

    // Subtotal
    filaTotal('Subtotal de productos', formatoMoneda(data.subtotal || 0));

    // Descuento Cliente
    if (data.descuentoCliente > 0) {
      const pct = data.descuentoClientePorcentaje ? ` (${data.descuentoClientePorcentaje}%)` : '';
      filaTotal(`Descuento cliente${pct}`, `-${formatoMoneda(data.descuentoCliente)}`, false, [180, 35, 24]);
    }

    // IVA
    if (data.aplicarIVA && data.iva > 0) {
      filaTotal(`IVA (${data.ivaPorcentaje || 19}%)`, formatoMoneda(data.iva));
    }

    // Retefuente
    if (data.aplicarReteFuente && data.retefuente > 0) {
      filaTotal(`Retención en la fuente (-${data.retefuentePorcentaje || 2.5}%)`, `-${formatoMoneda(data.retefuente)}`, false, [180, 35, 24]);
    }

    // ReteICA
    if (data.aplicarReteICA && data.reteica > 0) {
      filaTotal(`ReteICA (-${data.reteicaPorcentaje || 0.69}%)`, `-${formatoMoneda(data.reteica)}`, false, [180, 35, 24]);
    }

    // Línea separadora
    doc.setDrawColor(11, 35, 75);
    doc.setLineWidth(0.5);
    doc.line(xEtiquetas, yDer, xValores, yDer);
    yDer += 3;

    // GRAN TOTAL
    const totalFinal = Number(data.total) || 0;
    doc.setFont(fontFam, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 35, 75);
    doc.text('TOTAL:', xEtiquetas, yDer + 2.5);
    doc.text(formatoMoneda(totalFinal), xValores, yDer + 2.5, { align: 'right' });

    yDer += 10;

    // Caja destacada de Anticipo y Saldo
    doc.setFillColor(232, 247, 238);
    doc.roundedRect(xEtiquetas, yDer, 80, 15, 2, 2, 'F');
    doc.setDrawColor(183, 228, 199);
    doc.setLineWidth(0.3);
    doc.roundedRect(xEtiquetas, yDer, 80, 15, 2, 2, 'D');

    doc.setFont(fontFam, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(27, 122, 61);
    doc.text('Anticipo 50%:', xEtiquetas + 3, yDer + 5.5);
    doc.text(formatoMoneda(anticipo), xValores - 3, yDer + 5.5, { align: 'right' });

    doc.setFont(fontFam, 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Saldo contra entrega (50%):', xEtiquetas + 3, yDer + 11.5);
    doc.text(formatoMoneda(saldo), xValores - 3, yDer + 11.5, { align: 'right' });

    yDer += 19;

    // Notas u observaciones al pie
    const yMax = Math.max(yIzq, yDer);
    if (data.notas && yMax < 255) {
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('NOTAS Y OBSERVACIONES:', xMargen, yMax + 4);

      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const lineasNotas = doc.splitTextToSize(data.notas, 174);
      doc.text(lineasNotas, xMargen, yMax + 8);
    }
  }

  /**
   * Dibuja los pies de página globales con línea azul y paginación "Página X de Y"
   */
  function dibujarPies(doc, fontFam) {
    const totalPaginas = doc.internal.getNumberOfPages();
    const xMargen = 18;
    const yPie = 277;

    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);

      // Línea divisoria azul
      doc.setDrawColor(11, 35, 75);
      doc.setLineWidth(0.6);
      doc.line(xMargen, yPie, 192, yPie);

      // Datos corporativos del pie
      doc.setFont(fontFam, 'bold');
      doc.setFontSize(8);
      doc.setTextColor(11, 35, 75);
      doc.text('Depósito de Flejes San Martín', xMargen, yPie + 4.5);

      doc.setFont(fontFam, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(' · Hierro figurado para la construcción', xMargen + doc.getTextWidth('Depósito de Flejes San Martín'), yPie + 4.5);

      // Contactos centrados y a la derecha
      doc.text('Tel: (+57) 314 375 4285  |  flejessanmartin@hotmail.com', 105, yPie + 8.5, { align: 'center' });

      // Número de página
      doc.text(`Página ${p} de ${totalPaginas}`, 192, yPie + 4.5, { align: 'right' });
    }
  }

  // ----------------------------------------------------------------------------
  // MÉTODOS PÚBLICOS
  // ----------------------------------------------------------------------------

  /**
   * Compila el documento jsPDF con todas sus páginas
   */
  async function generar(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const fontFam = await registrarFuentes(doc);
    const logoData = await cargarImagenBase64('/image/logo.jpeg');

    const todosItems = Array.isArray(data.items) ? data.items : [];
    const numItems = todosItems.length;

    // Reglas de Paginación y Chunking (6 / 12 filas)
    if (numItems <= 6) {
      // Caso 1 (1 a 6 productos): 1 Sola página
      const yContenido = dibujarEncabezadoCompleto(doc, data, logoData, fontFam);
      const yDespuesTabla = dibujarTablaProductos(doc, todosItems, yContenido, fontFam, 6);
      dibujarTotalesYCondiciones(doc, data, yDespuesTabla, fontFam);
    } else if (numItems <= 12) {
      // Caso 2 (7 a 12 productos): 2 Páginas simétricas
      // Página 1: Encabezado completo + 12 filas de productos
      const yContenido = dibujarEncabezadoCompleto(doc, data, logoData, fontFam);
      dibujarTablaProductos(doc, todosItems, yContenido, fontFam, 12);

      // Página 2: Totales y condiciones
      doc.addPage();
      const yCont = dibujarEncabezadoContinuacion(doc, data, logoData, fontFam);
      dibujarTotalesYCondiciones(doc, data, yCont + 4, fontFam);
    } else {
      // Caso 3 (Más de 12 productos): Multi-página dinámica
      let index = 0;
      let esPrimera = true;

      while (index < numItems) {
        if (!esPrimera) {
          doc.addPage();
        }

        const yHeader = esPrimera
          ? dibujarEncabezadoCompleto(doc, data, logoData, fontFam)
          : dibujarEncabezadoContinuacion(doc, data, logoData, fontFam);

        const bloque = todosItems.slice(index, index + 12);
        index += 12;

        const esUltima = index >= numItems;
        const yDespuesTabla = dibujarTablaProductos(doc, bloque, yHeader, fontFam, esUltima ? 6 : 12);

        if (esUltima) {
          dibujarTotalesYCondiciones(doc, data, yDespuesTabla, fontFam);
        }

        esPrimera = false;
      }
    }

    // Pie de página global en todas las páginas generadas
    dibujarPies(doc, fontFam);

    return doc;
  }

  /**
   * Guarda el PDF en el servidor (/pdf/folio.pdf) y opcionalmente descarga local
   */
  async function guardarPdfEnServidor(data, descargar = false) {
    const doc = await generar(data);
    const folio = (data.folio || 'cotizacion').replace(/[^\w\-]/g, '_');
    const dataUri = doc.output('datauristring');
    const pdfBase64 = dataUri.includes('base64,') ? dataUri.split('base64,').pop() : dataUri;

    try {
      await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folio, pdfBase64 }),
      });
    } catch (e) {
      console.warn('No se pudo guardar PDF en servidor:', e);
    }

    if (descargar) {
      doc.save(`${folio}.pdf`);
    }

    return doc;
  }

  /**
   * Guarda y descarga directamente el archivo PDF
   */
  async function guardarYDescargar(data) {
    return guardarPdfEnServidor(data, true);
  }

  return {
    generar,
    guardarPdfEnServidor,
    guardarYDescargar,
  };
})();

// Exportar globalmente
window.PdfCotizacion = PdfCotizacion;
