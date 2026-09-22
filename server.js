/**
 * ==============================================================================
 * SERVIDOR PRINCIPAL - COTIZADOR DEPÓSITO DE FLEJES SAN MARTÍN
 * ==============================================================================
 * Sistema full-stack ligero para gestión de cotizaciones comerciales, clientes,
 * catálogo de productos, motor de descuentos y despacho de correo/WhatsApp.
 * 
 * Arquitectura: Express.js (Node.js) con persistencia atómica en archivos JSON.
 * ==============================================================================
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------------------
// 1. RUTAS Y CONSTANTES DEL SISTEMA
// ------------------------------------------------------------------------------
const ROOT = __dirname;
const JSON_DIR = path.join(ROOT, 'json');
const PDF_DIR = path.join(ROOT, 'pdf');
const BACKUP_DIR = path.join(ROOT, 'respaldos');
const PUBLIC_DIR = path.join(ROOT, 'public');

const FILES = {
  cotizaciones: path.join(JSON_DIR, 'cotizaciones.json'),
  clientes: path.join(JSON_DIR, 'clientes.json'),
  productos: path.join(JSON_DIR, 'productos.json'),
  descuentos: path.join(JSON_DIR, 'descuentos.json'),
  configuracion: path.join(JSON_DIR, 'configuracion.json'),
};

const CONFIGURACION_INICIAL = {
  empresa: {
    nombre: 'Depósito de Flejes San Martín',
    telefono: '(+57) 3143754285',
    email: 'flejessanmarin@hotmail.com',
  },
  whatsapp: {
    numero: '',
    mensaje: 'Hola {cliente}, le compartimos la cotización {folio} por un total de {total}.',
  },
  correo: {
    host: '',
    puerto: 587,
    seguro: false,
    usuario: '',
    contrasena: '',
    remitente: '',
  },
  ivaPorcentajeDefault: 19,
  aplicarIvaDefault: true,
  retefuentePorcentajeDefault: 4,
  aplicarReteFuenteDefault: true,
  reteicaPorcentajeDefault: 0.966,
  aplicarReteIcaDefault: false,
};

// Control de respaldos automáticos
let cotizacionesDesdeUltimoRespaldo = 0;
let ultimoRespaldoDia = '';

// ------------------------------------------------------------------------------
// 2. MIDDLEWARES GLOBALES
// ------------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/pdf', express.static(PDF_DIR));

// ------------------------------------------------------------------------------
// 3. CAPA DE PERSISTENCIA Y UTILIDADES DE ARCHIVO
// ------------------------------------------------------------------------------

/**
 * Garantiza la existencia de los directorios y archivos JSON iniciales.
 */
function ensureDirs() {
  [JSON_DIR, PDF_DIR, BACKUP_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  ['cotizaciones', 'clientes', 'productos', 'descuentos'].forEach((key) => {
    if (!fs.existsSync(FILES[key])) {
      fs.writeFileSync(FILES[key], '[]', 'utf8');
    }
  });

  if (!fs.existsSync(FILES.configuracion)) {
    fs.writeFileSync(
      FILES.configuracion,
      JSON.stringify(CONFIGURACION_INICIAL, null, 2),
      'utf8'
    );
  }
}

/**
 * Lee y parsea un archivo JSON de la capa de persistencia.
 * @param {string} fileKey - Clave del archivo en el diccionario FILES
 * @returns {Array|Object} Datos parseados
 */
function readJson(fileKey) {
  ensureDirs();
  try {
    const raw = fs.readFileSync(FILES[fileKey], 'utf8');
    return JSON.parse(raw || (fileKey === 'configuracion' ? '{}' : '[]'));
  } catch (err) {
    console.error(`[FS Error] Error leyendo ${fileKey}:`, err.message);
    return fileKey === 'configuracion' ? {} : [];
  }
}

/**
 * Escritura atómica segura compatible con Windows (reintentos ante bloqueo EPERM/EBUSY).
 * @param {string} fileKey - Clave del archivo
 * @param {any} data - Objeto o arreglo a serializar
 * @param {number} maxRetries - Intentos máximos de renombrado
 * @param {number} delayMs - Pausa progresiva entre intentos
 */
function writeJson(fileKey, data, maxRetries = 5, delayMs = 50) {
  ensureDirs();
  const filePath = FILES[fileKey];
  const tmpPath = `${filePath}.tmp`;

  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');

  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      if (['EPERM', 'EBUSY'].includes(err.code) && i < maxRetries - 1) {
        const wait = delayMs * (i + 1);
        const start = Date.now();
        while (Date.now() - start < wait) {}
      } else {
        throw err;
      }
    }
  }
}

/**
 * Genera un archivo de respaldo snapshot con todas las colecciones.
 * @returns {string} Nombre del archivo generado
 */
function crearRespaldoSnapshot() {
  ensureDirs();
  const fecha = new Date().toISOString().replace(/[:.]/g, '-');
  const archivo = path.join(BACKUP_DIR, `respaldo-${fecha}.json`);
  const respaldo = Object.fromEntries(
    Object.keys(FILES).map((key) => [key, readJson(key)])
  );

  fs.writeFileSync(
    archivo,
    JSON.stringify({ creadoEn: new Date().toISOString(), ...respaldo }, null, 2),
    'utf8'
  );

  cotizacionesDesdeUltimoRespaldo = 0;
  ultimoRespaldoDia = new Date().toISOString().slice(0, 10);
  return path.basename(archivo);
}

/**
 * Ejecuta respaldos automáticos según condiciones de tiempo o volumen.
 * @param {'diario'|'cotizaciones'} motivo
 */
function maybeAutoBackup(motivo) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (motivo === 'diario' && ultimoRespaldoDia === hoy) return null;
  if (motivo === 'cotizaciones' && cotizacionesDesdeUltimoRespaldo < 10) return null;

  try {
    return crearRespaldoSnapshot();
  } catch (err) {
    console.error('[Backup Error] Respaldo automático falló:', err.message);
    return null;
  }
}

/**
 * Obtiene la configuración consolidada con valores predeterminados.
 * @returns {object} Configuración del sistema
 */
function readConfiguracion() {
  const saved = readJson('configuracion');
  return {
    ...CONFIGURACION_INICIAL,
    ...saved,
    empresa: { ...CONFIGURACION_INICIAL.empresa, ...(saved.empresa || {}) },
    correo: { ...CONFIGURACION_INICIAL.correo, ...(saved.correo || {}) },
    whatsapp: { ...CONFIGURACION_INICIAL.whatsapp, ...(saved.whatsapp || {}) },
    ivaPorcentajeDefault: Number(
      saved.ivaPorcentajeDefault ?? CONFIGURACION_INICIAL.ivaPorcentajeDefault
    ) || 0,
    aplicarIvaDefault: saved.aplicarIvaDefault !== false,
    retefuentePorcentajeDefault: Number(
      saved.retefuentePorcentajeDefault ?? CONFIGURACION_INICIAL.retefuentePorcentajeDefault
    ) || 0,
    aplicarReteFuenteDefault: saved.aplicarReteFuenteDefault !== false,
    reteicaPorcentajeDefault: Number(
      saved.reteicaPorcentajeDefault ?? CONFIGURACION_INICIAL.reteicaPorcentajeDefault
    ) || 0,
    aplicarReteIcaDefault: Boolean(saved.aplicarReteIcaDefault),
  };
}

/**
 * Calcula el siguiente folio incremental en formato COT-YYYY-XXXX.
 * @param {Array} cotizaciones - Arreglo de cotizaciones actuales
 * @returns {string} Folio generado
 */
function nextFolio(cotizaciones) {
  const year = new Date().getFullYear();
  const prefix = `COT-${year}-`;
  const nums = cotizaciones
    .map((c) => c.folio)
    .filter((f) => typeof f === 'string' && f.startsWith(prefix))
    .map((f) => parseInt(f.replace(prefix, ''), 10))
    .filter((n) => !Number.isNaN(n));

  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

// ------------------------------------------------------------------------------
// 4. CONTROLADORES API: COTIZACIONES
// ------------------------------------------------------------------------------

// Listar todas las cotizaciones (ordenadas de más reciente a más antigua)
app.get('/api/cotizaciones', (req, res) => {
  try {
    const data = readJson('cotizaciones');
    data.sort((a, b) => new Date(b.actualizadoEn || b.creadoEn) - new Date(a.actualizadoEn || a.creadoEn));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron leer las cotizaciones' });
  }
});

// Obtener una cotización por ID
app.get('/api/cotizaciones/:id', (req, res) => {
  try {
    const data = readJson('cotizaciones');
    const item = data.find((c) => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error al leer la cotización' });
  }
});

// Crear una nueva cotización
app.post('/api/cotizaciones', (req, res) => {
  try {
    if (!req.body || !req.body.destinatario || !req.body.destinatario.nombre) {
      return res.status(400).json({ error: 'El nombre del destinatario es obligatorio' });
    }

    const data = readJson('cotizaciones');
    const now = new Date().toISOString();

    const nueva = {
      id: uuidv4(),
      folio: nextFolio(data),
      ...req.body,
      estado: req.body.estado || 'borrador',
      version: 1,
      historialVersiones: [],
      creadoEn: now,
      actualizadoEn: now,
    };

    data.push(nueva);
    writeJson('cotizaciones', data);

    cotizacionesDesdeUltimoRespaldo += 1;
    maybeAutoBackup('cotizaciones');

    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar la cotización' });
  }
});

// Duplicar una cotización existente
app.post('/api/cotizaciones/:id/duplicar', (req, res) => {
  try {
    const data = readJson('cotizaciones');
    const origen = data.find((c) => c.id === req.params.id);
    if (!origen) return res.status(404).json({ error: 'Cotización no encontrada' });

    const now = new Date().toISOString();
    const { id, folio, creadoEn, actualizadoEn, historialVersiones, ...resto } = origen;

    const copia = {
      ...resto,
      id: uuidv4(),
      folio: nextFolio(data),
      duplicadaDeFolio: origen.folio,
      duplicadaDeId: origen.id,
      estado: 'borrador',
      version: 1,
      historialVersiones: [],
      creadoEn: now,
      actualizadoEn: now,
    };

    data.push(copia);
    writeJson('cotizaciones', data);

    cotizacionesDesdeUltimoRespaldo += 1;
    maybeAutoBackup('cotizaciones');

    res.status(201).json(copia);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo duplicar la cotización' });
  }
});

// Actualizar una cotización existente (con historial de versiones)
app.put('/api/cotizaciones/:id', (req, res) => {
  try {
    const data = readJson('cotizaciones');
    const index = data.findIndex((c) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Cotización no encontrada' });

    const previa = data[index];
    const historial = Array.isArray(previa.historialVersiones)
      ? previa.historialVersiones.slice()
      : [];

    historial.push({
      version: Number(previa.version) || 1,
      guardadoEn: previa.actualizadoEn || previa.creadoEn,
      snapshot: { ...previa, historialVersiones: undefined },
    });

    if (historial.length > 20) {
      historial.splice(0, historial.length - 20);
    }

    const actualizada = {
      ...previa,
      ...req.body,
      id: previa.id,
      folio: previa.folio,
      creadoEn: previa.creadoEn,
      historialVersiones: historial,
      version: (Number(previa.version) || 1) + 1,
      actualizadoEn: new Date().toISOString(),
    };

    data[index] = actualizada;
    writeJson('cotizaciones', data);
    res.json(actualizada);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar la cotización' });
  }
});

// Anulación lógica de cotizaciones (evita pérdida accidental de datos)
app.delete('/api/cotizaciones/:id', (req, res) => {
  try {
    const data = readJson('cotizaciones');
    const index = data.findIndex((c) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Cotización no encontrada' });

    data[index] = {
      ...data[index],
      estado: 'anulada',
      actualizadoEn: new Date().toISOString(),
    };

    writeJson('cotizaciones', data);
    res.json({ ok: true, estado: 'anulada' });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo anular la cotización' });
  }
});

// ------------------------------------------------------------------------------
// 5. CONTROLADORES API: CLIENTES
// ------------------------------------------------------------------------------

app.get('/api/clientes', (req, res) => {
  try {
    res.json(readJson('clientes'));
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron leer los clientes' });
  }
});

/**
 * Normaliza cadenas para comparación insensible a mayúsculas, acentos y espacios múltiples
 * @param {string} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  if (!texto) return '';
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza números de identificación (NIT/Cédula) eliminando puntos, guiones y espacios
 * @param {string} doc
 * @returns {string}
 */
function normalizarDoc(doc) {
  if (!doc) return '';
  return String(doc).replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

app.post('/api/clientes', (req, res) => {
  try {
    const nombre = req.body?.nombre?.trim();
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }

    const data = readJson('clientes');
    const normNombre = normalizarTexto(nombre);
    const duplicadoNombre = data.find((c) => normalizarTexto(c.nombre) === normNombre);
    if (duplicadoNombre) {
      return res.status(400).json({
        error: `Ya existe un cliente registrado con el nombre "${duplicadoNombre.nombre}".`,
      });
    }

    const nit = req.body?.nit ? String(req.body.nit).trim() : '';
    if (nit) {
      const normNit = normalizarDoc(nit);
      if (normNit) {
        const duplicadoNit = data.find((c) => c.nit && normalizarDoc(c.nit) === normNit);
        if (duplicadoNit) {
          return res.status(400).json({
            error: `Ya existe un cliente registrado con el NIT/Cédula "${duplicadoNit.nit}" (${duplicadoNit.nombre}).`,
          });
        }
      }
    }

    const nuevo = {
      id: uuidv4(),
      nombre,
      empresa: req.body?.empresa ? String(req.body.empresa).trim() : '',
      telefono: req.body?.telefono ? String(req.body.telefono).trim() : '',
      email: req.body?.email ? String(req.body.email).trim() : '',
      direccion: req.body?.direccion ? String(req.body.direccion).trim() : '',
      nit,
      tipoCliente: req.body?.tipoCliente || 'persona',
      creadoEn: new Date().toISOString(),
    };

    data.push(nuevo);
    writeJson('clientes', data);
    res.status(201).json(nuevo);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar el cliente' });
  }
});

app.put('/api/clientes/:id', (req, res) => {
  try {
    const data = readJson('clientes');
    const index = data.findIndex((c) => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (req.body?.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) {
        return res.status(400).json({ error: 'El nombre del cliente no puede estar vacío' });
      }
      const normNombre = normalizarTexto(nombre);
      const duplicadoNombre = data.find(
        (c) => c.id !== req.params.id && normalizarTexto(c.nombre) === normNombre
      );
      if (duplicadoNombre) {
        return res.status(400).json({
          error: `Ya existe otro cliente registrado con el nombre "${duplicadoNombre.nombre}".`,
        });
      }
      data[index].nombre = nombre;
    }

    if (req.body?.nit !== undefined) {
      const nit = String(req.body.nit).trim();
      if (nit) {
        const normNit = normalizarDoc(nit);
        if (normNit) {
          const duplicadoNit = data.find(
            (c) => c.id !== req.params.id && c.nit && normalizarDoc(c.nit) === normNit
          );
          if (duplicadoNit) {
            return res.status(400).json({
              error: `Ya existe otro cliente registrado con el NIT/Cédula "${duplicadoNit.nit}" (${duplicadoNit.nombre}).`,
            });
          }
        }
      }
      data[index].nit = nit;
    }

    if (req.body?.empresa !== undefined) data[index].empresa = String(req.body.empresa).trim();
    if (req.body?.telefono !== undefined) data[index].telefono = String(req.body.telefono).trim();
    if (req.body?.email !== undefined) data[index].email = String(req.body.email).trim();
    if (req.body?.direccion !== undefined) data[index].direccion = String(req.body.direccion).trim();
    if (req.body?.tipoCliente !== undefined) data[index].tipoCliente = req.body.tipoCliente || 'persona';

    data[index].actualizadoEn = new Date().toISOString();
    writeJson('clientes', data);
    res.json(data[index]);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el cliente' });
  }
});

app.delete('/api/clientes/:id', (req, res) => {
  try {
    let data = readJson('clientes');
    data = data.filter((c) => c.id !== req.params.id);
    writeJson('clientes', data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el cliente' });
  }
});

// ------------------------------------------------------------------------------
// 6. CONTROLADORES API: PRODUCTOS E INVENTARIO
// ------------------------------------------------------------------------------

app.get('/api/productos', (req, res) => {
  try {
    res.json(readJson('productos'));
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron leer los productos' });
  }
});

app.post('/api/productos', (req, res) => {
  try {
    const nombre = req.body?.nombre?.trim();
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
    }

    const data = readJson('productos');
    const norm = normalizarTexto(nombre);
    const duplicado = data.find((p) => normalizarTexto(p.nombre) === norm);
    if (duplicado) {
      return res.status(400).json({
        error: `Ya existe un producto registrado en el catálogo con el nombre "${duplicado.nombre}".`,
      });
    }

    const precio = Number(req.body?.precio);
    if (isNaN(precio) || precio <= 0) {
      return res.status(400).json({
        error: 'El precio unitario debe ser mayor a 0 (no se permiten valores en 0 ni negativos)',
      });
    }

    const stockActual = Math.max(0, Number(req.body?.stockActual) || 0);
    const stockMinimo = Math.max(0, Number(req.body?.stockMinimo) || 0);

    const nuevo = {
      id: uuidv4(),
      nombre,
      descripcion: req.body?.descripcion ? String(req.body.descripcion).trim() : '',
      unidad: req.body?.unidad ? String(req.body.unidad).trim() : 'pza',
      precio,
      stockActual,
      stockMinimo,
      creadoEn: new Date().toISOString(),
    };

    data.push(nuevo);
    writeJson('productos', data);
    res.status(201).json(nuevo);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar el producto' });
  }
});

app.put('/api/productos/:id', (req, res) => {
  try {
    const data = readJson('productos');
    const index = data.findIndex((p) => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });

    if (req.body?.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) {
        return res.status(400).json({ error: 'El nombre del producto no puede estar vacío' });
      }
      const norm = normalizarTexto(nombre);
      const duplicado = data.find(
        (p) => p.id !== req.params.id && normalizarTexto(p.nombre) === norm
      );
      if (duplicado) {
        return res.status(400).json({
          error: `Ya existe otro producto registrado con el nombre "${duplicado.nombre}".`,
        });
      }
      data[index].nombre = nombre;
    }

    if (req.body?.precio !== undefined) {
      const precio = Number(req.body.precio);
      if (isNaN(precio) || precio <= 0) {
        return res.status(400).json({
          error: 'El precio unitario debe ser mayor a 0 (no se permiten valores en 0 ni negativos)',
        });
      }
      data[index].precio = precio;
    }

    if (req.body?.descripcion !== undefined) {
      data[index].descripcion = String(req.body.descripcion).trim();
    }
    if (req.body?.unidad !== undefined) {
      data[index].unidad = String(req.body.unidad).trim() || 'pza';
    }
    if (req.body?.stockActual !== undefined) {
      const stockActual = Number(req.body.stockActual);
      if (isNaN(stockActual) || stockActual < 0) {
        return res.status(400).json({ error: 'El stock actual no puede ser negativo' });
      }
      data[index].stockActual = stockActual;
    }
    if (req.body?.stockMinimo !== undefined) {
      const stockMinimo = Number(req.body.stockMinimo);
      if (isNaN(stockMinimo) || stockMinimo < 0) {
        return res.status(400).json({ error: 'El stock mínimo no puede ser negativo' });
      }
      data[index].stockMinimo = stockMinimo;
    }

    data[index].actualizadoEn = new Date().toISOString();
    writeJson('productos', data);
    res.json(data[index]);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el producto' });
  }
});

app.delete('/api/productos/:id', (req, res) => {
  try {
    let data = readJson('productos');
    data = data.filter((p) => p.id !== req.params.id);
    writeJson('productos', data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar el producto' });
  }
});

app.get('/api/inventario/alertas', (req, res) => {
  try {
    const alertas = readJson('productos')
      .filter(
        (p) =>
          Number.isFinite(Number(p.stockActual)) &&
          Number(p.stockActual) <= (Number(p.stockMinimo) || 0)
      )
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        stockActual: Number(p.stockActual),
        stockMinimo: Number(p.stockMinimo) || 0,
        unidad: p.unidad || 'pza',
      }));

    res.json(alertas);
  } catch {
    res.status(500).json({ error: 'No se pudieron consultar las alertas de inventario' });
  }
});

// ------------------------------------------------------------------------------
// 7. CONTROLADORES API: DESCUENTOS Y CONFIGURACIÓN
// ------------------------------------------------------------------------------

app.get('/api/descuentos', (req, res) => {
  try {
    res.json(readJson('descuentos'));
  } catch {
    res.status(500).json({ error: 'No se pudieron leer los descuentos' });
  }
});

app.put('/api/descuentos', (req, res) => {
  try {
    const descuentos = Array.isArray(req.body) ? req.body : [];
    const limpios = descuentos
      .filter((d) => d && ['cliente', 'producto'].includes(d.tipo) && d.referenciaId)
      .map((d) => ({
        id: d.id || uuidv4(),
        tipo: d.tipo,
        referenciaId: String(d.referenciaId),
        porcentaje: Math.max(0, Math.min(100, Number(d.porcentaje) || 0)),
      }));

    writeJson('descuentos', limpios);
    res.json(limpios);
  } catch {
    res.status(500).json({ error: 'No se pudieron guardar los descuentos' });
  }
});

app.get('/api/configuracion', (req, res) => {
  try {
    const config = readConfiguracion();
    if (config.correo.contrasena) config.correo.contrasena = '********';
    res.json(config);
  } catch {
    res.status(500).json({ error: 'No se pudo leer la configuración' });
  }
});

app.put('/api/configuracion', (req, res) => {
  try {
    const actual = readConfiguracion();
    const correoEntrada = req.body?.correo || {};

    const siguiente = {
      empresa: { ...actual.empresa, ...(req.body?.empresa || {}) },
      whatsapp: { ...actual.whatsapp, ...(req.body?.whatsapp || {}) },
      correo: { ...actual.correo, ...correoEntrada },
      ivaPorcentajeDefault: Number(
        req.body?.ivaPorcentajeDefault ?? actual.ivaPorcentajeDefault ?? 19
      ) || 0,
      aplicarIvaDefault: req.body?.aplicarIvaDefault !== undefined
        ? Boolean(req.body.aplicarIvaDefault)
        : actual.aplicarIvaDefault,
      retefuentePorcentajeDefault: Number(
        req.body?.retefuentePorcentajeDefault ?? actual.retefuentePorcentajeDefault ?? 4
      ) || 0,
      aplicarReteFuenteDefault: req.body?.aplicarReteFuenteDefault !== undefined
        ? Boolean(req.body.aplicarReteFuenteDefault)
        : actual.aplicarReteFuenteDefault,
      reteicaPorcentajeDefault: Number(
        req.body?.reteicaPorcentajeDefault ?? actual.reteicaPorcentajeDefault ?? 0.966
      ) || 0,
      aplicarReteIcaDefault: req.body?.aplicarReteIcaDefault !== undefined
        ? Boolean(req.body.aplicarReteIcaDefault)
        : actual.aplicarReteIcaDefault,
    };

    if (correoEntrada.contrasena === '********') {
      siguiente.correo.contrasena = actual.correo.contrasena;
    }

    writeJson('configuracion', siguiente);
    siguiente.correo.contrasena = siguiente.correo.contrasena ? '********' : '';
    res.json(siguiente);
  } catch {
    res.status(500).json({ error: 'No se pudo guardar la configuración' });
  }
});

app.post('/api/respaldos', (req, res) => {
  try {
    const archivo = crearRespaldoSnapshot();
    res.status(201).json({ ok: true, archivo });
  } catch {
    res.status(500).json({ error: 'No se pudo crear el respaldo' });
  }
});

// ------------------------------------------------------------------------------
// 8. CONTROLADORES API: DESPACHO DE CORREO SMTP Y PDF
// ------------------------------------------------------------------------------

app.post('/api/correo/enviar', async (req, res) => {
  try {
    const { destinatario, asunto, mensaje, pdfBase64, nombreArchivo } = req.body || {};
    const correo = readConfiguracion().correo;

    if (!destinatario || !correo.host || !correo.usuario || !correo.contrasena) {
      return res.status(400).json({
        error: 'Configure el servidor SMTP y el correo remitente antes de enviar.',
      });
    }

    const transporter = nodemailer.createTransport({
      host: correo.host,
      port: Number(correo.puerto) || 587,
      secure: Boolean(correo.seguro),
      auth: { user: correo.usuario, pass: correo.contrasena },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    });

    const adjunto = String(pdfBase64 || '').split('base64,').pop();

    await transporter.sendMail({
      from: correo.remitente || correo.usuario,
      to: destinatario,
      subject: asunto || 'Cotización',
      text: mensaje || '',
      attachments: adjunto
        ? [{ filename: nombreArchivo || 'cotizacion.pdf', content: adjunto, encoding: 'base64' }]
        : [],
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: `No se pudo enviar el correo: ${err.message}` });
  }
});

app.post('/api/pdf', (req, res) => {
  try {
    ensureDirs();
    const { folio, pdfBase64 } = req.body;

    if (!folio || !pdfBase64) {
      return res.status(400).json({ error: 'Faltan folio o archivo PDF' });
    }

    const safeFolio = String(folio).replace(/[^\w\-]/g, '_');
    const fileName = `${safeFolio}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);

    const raw = String(pdfBase64);
    const base64Data = raw.includes('base64,')
      ? raw.split('base64,').pop()
      : raw.replace(/^data:application\/pdf;base64,/, '');

    const buffer = Buffer.from(base64Data.replace(/\s/g, ''), 'base64');

    if (buffer.length < 100 || buffer.slice(0, 4).toString() !== '%PDF') {
      return res.status(400).json({ error: 'El PDF recibido no es válido' });
    }

    fs.writeFileSync(filePath, buffer);
    res.json({ ok: true, archivo: fileName, ruta: `/pdf/${fileName}`, bytes: buffer.length });
  } catch (err) {
    console.error('[PDF Error]', err);
    res.status(500).json({ error: 'No se pudo guardar el PDF' });
  }
});

// ------------------------------------------------------------------------------
// 9. INICIALIZACIÓN Y ARRANQUE DEL SERVIDOR
// ------------------------------------------------------------------------------
ensureDirs();
maybeAutoBackup('diario');
setInterval(() => maybeAutoBackup('diario'), 60 * 60 * 1000); // Revisión horaria para backup diario

function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ interface: name, address: iface.address });
      }
    }
  }
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIps();
  console.log(`\n=============================================================`);
  console.log(`  🚀 COTIZADOR - DEPÓSITO DE FLEJES SAN MARTÍN`);
  console.log(`=============================================================`);
  console.log(`  • Servidor Local (este equipo):  http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`  • Acceso desde la Red Local (Wi-Fi / LAN):`);
    ips.forEach((ip) => {
      console.log(`    - http://${ip.address}:${PORT}  (${ip.interface})`);
    });
  } else {
    console.log(`  • En red local: http://[IP_DE_ESTE_EQUIPO]:${PORT}`);
  }
  console.log(`=============================================================\n`);
});
