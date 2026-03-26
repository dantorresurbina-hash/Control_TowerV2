/**
 * ============================================================
 * PATCH: Correos desde el Dashboard (Web → GAS)
 * ============================================================
 * Agrega esto al FINAL de tu script en Apps Script.
 *
 * Luego, en tu función doPost, dentro del switch(action),
 * agrega ANTES del `default`:
 *
 *   case 'emailDraft':
 *     result = handleEmailAction_(body, 'draft');
 *     break;
 *   case 'emailSend':
 *     result = handleEmailAction_(body, 'send');
 *     break;
 * ============================================================
 */

/**
 * Crea un borrador de Gmail o envía directamente.
 * Actualiza el estado del pedido en la hoja a "correo enviado".
 *
 * @param {Object} body  - { pedidoId, to, cc, subject, emailBody }
 * @param {string} type  - 'draft' | 'send'
 */
function handleEmailAction_(body, type) {
  const { pedidoId, to, cc, subject, emailBody } = body;

  if (!to || !subject || !emailBody) {
    return { success: false, error: 'Faltan campos requeridos: to, subject, emailBody' };
  }

  // Convertir adjuntos base64 → Blobs
  const blobs = (body.attachments || []).map(a => {
    try {
      return Utilities.newBlob(
        Utilities.base64Decode(a.data),
        a.mimeType || 'application/octet-stream',
        a.name
      );
    } catch(e) {
      console.warn('[handleEmailAction_] No se pudo decodificar adjunto:', a.name, e.message);
      return null;
    }
  }).filter(Boolean);

  let draftUrl = '';

  if (type === 'draft') {
    const draft = GmailApp.createDraft(to, subject, emailBody, {
      cc:          cc || '',
      attachments: blobs,
    });
    draftUrl = 'https://mail.google.com/mail/u/0/#drafts?compose=' + draft.getId();
  } else {
    MailApp.sendEmail({
      to:          to,
      cc:          cc || '',
      subject:     subject,
      body:        emailBody,
      attachments: blobs,
    });
  }

  // Actualizar hoja "Seguimiento talleres"
  try {
    const ss    = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Seguimiento talleres');

    if (sheet) {
      const data = getSheetData(sheet, 2);

      for (let i = 0; i < data.length; i++) {
        const rowId = normalizeKey(
          data[i].ncotizacion || data[i].nproyecto || data[i].pedidoid || data[i].id || ''
        );
        if (rowId !== normalizeKey(pedidoId)) continue;

        const rowNum = i + 2 + 1; // headerRow=2, datos desde fila 3

        // Estado → "correo enviado"
        const colStatus = getHeaderCol(sheet, 'ESTADO', 2)
          || getHeaderCol(sheet, 'Estado', 2)
          || getHeaderCol(sheet, 'Estado Produccion', 2)
          || getHeaderCol(sheet, 'Estado Producción', 2);
        if (colStatus > 0) sheet.getRange(rowNum, colStatus).setValue('correo enviado');

        // MAIL_GENERADO
        const colMailGen = ensureEmailHeaderCol_(sheet, 'MAIL_GENERADO');
        if (colMailGen > 0) sheet.getRange(rowNum, colMailGen).setValue(type === 'draft' ? 'BORRADOR CREADO' : 'ENVIADO');

        // DRAFT_URL (solo si es borrador)
        if (type === 'draft' && draftUrl) {
          const colDraft = ensureEmailHeaderCol_(sheet, 'DRAFT_URL');
          if (colDraft > 0) sheet.getRange(rowNum, colDraft).setValue(draftUrl);
        }

        // Fecha envío maqueta
        const colFecha = getHeaderCol(sheet, 'Fecha envío maqueta', 2)
          || getHeaderCol(sheet, 'Fecha envio maqueta', 2)
          || getHeaderCol(sheet, 'Fecha Envío Taller', 2);
        if (colFecha > 0) sheet.getRange(rowNum, colFecha).setValue(new Date());

        break;
      }

      SpreadsheetApp.flush();
    }
  } catch (e) {
    console.warn('[handleEmailAction_] Sheet update failed:', e.message);
    // No falla la llamada — el email ya se creó/envió
  }

  return { success: true, draftUrl: draftUrl, sent: type === 'send' };
}

/**
 * Asegura que exista una columna con ese nombre en la fila 2.
 * Si no existe, la crea al final. Retorna el número de columna (1-based).
 */
function ensureEmailHeaderCol_(sheet, colName) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const idx = headers.indexOf(colName);
  if (idx !== -1) return idx + 1;
  sheet.getRange(2, lastCol + 1).setValue(colName);
  return lastCol + 1;
}
