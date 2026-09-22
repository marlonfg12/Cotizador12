/**
 * ==============================================================================
 * CONTROLADOR DE CONFIGURACIÓN Y PARÁMETROS DEL SISTEMA
 * ==============================================================================
 * Gestiona los valores por defecto de IVA, Retefuente, plantillas de WhatsApp,
 * credenciales SMTP para correo electrónico y creación manual de respaldos.
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos del formulario
  const formConfig = document.getElementById('formConfig');
  const ivaPorcentajeDefault = document.getElementById('ivaPorcentajeDefault');
  const retefuentePorcentajeDefault = document.getElementById('retefuentePorcentajeDefault');
  const reteicaPorcentajeDefault = document.getElementById('reteicaPorcentajeDefault');
  const aplicarIvaDefault = document.getElementById('aplicarIvaDefault');
  const aplicarReteFuenteDefault = document.getElementById('aplicarReteFuenteDefault');
  const aplicarReteIcaDefault = document.getElementById('aplicarReteIcaDefault');

  // WhatsApp
  const waNumero = document.getElementById('waNumero');
  const waMensaje = document.getElementById('waMensaje');

  // Correo SMTP
  const host = document.getElementById('host');
  const puerto = document.getElementById('puerto');
  const usuario = document.getElementById('usuario');
  const contrasena = document.getElementById('contrasena');
  const remitente = document.getElementById('remitente');

  // Botones de acción y asistentes
  const btnRespaldo = document.getElementById('respaldo');
  const btnConfigGmail = document.getElementById('btnConfigGmail');
  const btnConfigOutlook = document.getElementById('btnConfigOutlook');

  /**
   * Carga la configuración actual almacenada en el backend
   */
  async function cargarConfiguracion() {
    try {
      const config = await Api.getConfiguracion();

      if (config) {
        // Impuestos
        if (ivaPorcentajeDefault) {
          ivaPorcentajeDefault.value = config.ivaPorcentajeDefault ?? 19;
        }
        if (retefuentePorcentajeDefault) {
          retefuentePorcentajeDefault.value = config.retefuentePorcentajeDefault ?? 4;
        }
        if (reteicaPorcentajeDefault) {
          reteicaPorcentajeDefault.value = config.reteicaPorcentajeDefault ?? 0.966;
        }
        if (aplicarIvaDefault) {
          aplicarIvaDefault.checked = config.aplicarIvaDefault !== false;
        }
        if (aplicarReteFuenteDefault) {
          aplicarReteFuenteDefault.checked = config.aplicarReteFuenteDefault !== false;
        }
        if (aplicarReteIcaDefault) {
          aplicarReteIcaDefault.checked = Boolean(config.aplicarReteIcaDefault);
        }

        // WhatsApp
        if (config.whatsapp) {
          waNumero.value = config.whatsapp.numero || '';
          waMensaje.value = config.whatsapp.mensaje || '';
        }

        // Correo SMTP
        if (config.correo) {
          host.value = config.correo.host || '';
          puerto.value = config.correo.puerto || 587;
          usuario.value = config.correo.usuario || '';
          contrasena.value = config.correo.contrasena || '';
          remitente.value = config.correo.remitente || '';
        }
      }
    } catch (err) {
      UI.showMessage('error', `Error al cargar la configuración: ${err.message}`);
    }
  }

  // Asistente rápido para Gmail
  if (btnConfigGmail) {
    btnConfigGmail.addEventListener('click', (e) => {
      e.preventDefault();
      host.value = 'smtp.gmail.com';
      puerto.value = 587;
      UI.showMessage(
        'info',
        'Campos SMTP preconfigurados para Gmail. Ingrese su correo y su contraseña de aplicación.'
      );
    });
  }

  // Asistente rápido para Outlook / Hotmail
  if (btnConfigOutlook) {
    btnConfigOutlook.addEventListener('click', (e) => {
      e.preventDefault();
      host.value = 'smtp-mail.outlook.com';
      puerto.value = 587;
      UI.showMessage(
        'info',
        'Campos SMTP preconfigurados para Outlook. Ingrese su correo y su contraseña de aplicación.'
      );
    });
  }

  // Guardar configuración
  formConfig.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearMessage();

    const payload = {
      ivaPorcentajeDefault: Math.max(0, Math.min(100, Number(ivaPorcentajeDefault.value) || 0)),
      retefuentePorcentajeDefault: Math.max(
        0,
        Math.min(100, Number(retefuentePorcentajeDefault.value) || 0)
      ),
      reteicaPorcentajeDefault: Math.max(
        0,
        Math.min(100, Number(reteicaPorcentajeDefault.value) || 0)
      ),
      aplicarIvaDefault: Boolean(aplicarIvaDefault?.checked),
      aplicarReteFuenteDefault: Boolean(aplicarReteFuenteDefault?.checked),
      aplicarReteIcaDefault: Boolean(aplicarReteIcaDefault?.checked),
      whatsapp: {
        numero: waNumero.value.trim(),
        mensaje: waMensaje.value.trim(),
      },
      correo: {
        host: host.value.trim(),
        puerto: parseInt(puerto.value, 10) || 587,
        usuario: usuario.value.trim(),
        contrasena: contrasena.value,
        remitente: remitente.value.trim(),
      },
    };

    try {
      await Api.guardarConfiguracion(payload);
      UI.showMessage('exito', 'Configuración guardada correctamente.');
    } catch (err) {
      UI.showMessage('error', `Error al guardar configuración: ${err.message}`);
    }
  });

  // Crear respaldo manual
  if (btnRespaldo) {
    btnRespaldo.addEventListener('click', async () => {
      UI.clearMessage();
      try {
        const res = await Api.crearRespaldo();
        UI.showMessage('exito', `Respaldo creado con éxito en /respaldos: ${res.archivo}`);
      } catch (err) {
        UI.showMessage('error', `Error al crear respaldo: ${err.message}`);
      }
    });
  }

  // Carga inicial
  await cargarConfiguracion();
});
