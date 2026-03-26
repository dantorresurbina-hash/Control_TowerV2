/**
 * ============================================================
 * PATCH para Control Tower GAS v3.1
 * ============================================================
 * Agrega esto al FINAL de tu script en Apps Script.
 * Resuelve 3 problemas de compatibilidad con DASH3:
 *
 * PROBLEMA 1: cells = {"J": fecha, "AH": nombre}
 *   → handleUpdate busca por nombre de columna, no por letra.
 *   → PATCH: si la clave es una letra de columna, usarla directo.
 *
 * PROBLEMA 2: batchUpdate enviaba action en URL, no en body.
 *   → PATCH: doPost también lee e.parameter.action como fallback.
 *
 * PROBLEMA 3: ingestDirectOrders no existe en tu GAS.
 *   → PATCH: agregar el case "ingestDirectOrders".
 * ============================================================
 */

/**
 * Convierte letra(s) de columna a número 1-based.
 * Ej: "A"→1, "F"→6, "J"→10, "AH"→34, "AJ"→36
 * Si ya existe colLetterToNumber en tu script, elimina esta copia.
 */
function colLetterToNum_(letter) {
  letter = String(letter).toUpperCase().trim();
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num;
}

/**
 * Versión mejorada de handleUpdate que soporta LETRAS de columna en cells.
 * Reemplaza tu función handleUpdate actual con esta.
 *
 * Cambios respecto al original:
 *  - Si getHeaderCol no encuentra el header, intenta interpretarlo como letra de columna.
 *  - Registra en el log qué celdas se actualizaron y cuáles no se encontraron.
 */
function handleUpdate(pedidoId, estado, bultos, usuario, cells) {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Seguimiento talleres");
  if (!sheet) throw new Error("Hoja 'Seguimiento talleres' no encontrada.");

  const data = getSheetData(sheet, 2);
  let rowIndex = -1;
  let pedidoRaw = null;
  const searchId = normalizeKey(pedidoId);

  for (let i = 0; i < data.length; i++) {
    const rowId = normalizeKey(data[i].ncotizacion || data[i].nproyecto || data[i].pedidoid || data[i].id || "");
    if (rowId === searchId) {
      rowIndex = i + 2 + 1; // headerRow=2, data starts at row 3
      pedidoRaw = data[i];
      break;
    }
  }

  if (!pedidoRaw) throw new Error("Pedido no encontrado: " + pedidoId);

  // Actualizar celdas específicas (por nombre de columna O por letra)
  if (cells && typeof cells === 'object') {
    for (const key in cells) {
      if (!key || cells[key] === undefined || cells[key] === null) continue;

      let col = getHeaderCol(sheet, key, 2);

      // Fallback: si no encontró por nombre, intentar como letra de columna
      if (col === -1 && /^[A-Z]{1,2}$/.test(String(key).toUpperCase())) {
        col = colLetterToNum_(key);
        console.log(`[handleUpdate] Columna "${key}" no encontrada como header, usando letra → col ${col}`);
      }

      if (col > 0) {
        const val = cells[key];
        const cell = sheet.getRange(rowIndex, col);
        if (val === true || val === 'true') {
          cell.setValue(true);
        } else if (val === false || val === 'false') {
          cell.setValue(false);
        } else {
          cell.setValue(String(val));
        }
      } else {
        console.warn(`[handleUpdate] Columna "${key}" no encontrada. Verifica el nombre del encabezado en fila 2.`);
      }
    }
  }

  // Actualizar estado de producción
  if (estado) {
    const colStatus = getHeaderCol(sheet, "Estado", 2)
      || getHeaderCol(sheet, "Estado taller", 2)
      || getHeaderCol(sheet, "Estado Produccion", 2)
      || getHeaderCol(sheet, "Estado Producción", 2);

    if (colStatus > 0) {
      const anterior = pedidoRaw.estado || pedidoRaw.estadotaller || pedidoRaw.estadoproduccion || "";
      sheet.getRange(rowIndex, colStatus).setValue(estado);
      logCambio({
        pedidoId: searchId,
        campo: "Estado",
        anterior: anterior,
        nuevo: estado,
        usuario: usuario || "Dashboard",
        taller: pedidoRaw.taller || "",
        tipoAccion: "MANUAL"
      });
    }
  }

  // Actualizar bultos si se envió
  if (bultos) {
    const colBultos = getHeaderCol(sheet, "Bultos", 2) || getHeaderCol(sheet, "Cajas", 2);
    if (colBultos > 0) sheet.getRange(rowIndex, colBultos).setValue(bultos);
  }

  SpreadsheetApp.flush();
  return { success: true, row: rowIndex };
}

/**
 * Agrega soporte para ingestDirectOrders en doPost.
 * Pega este bloque dentro del switch(action) de tu doPost, antes del `default`:
 *
 *   case "ingestDirectOrders":
 *     result = handleIngestDirectOrders_(body);
 *     break;
 */
function handleIngestDirectOrders_(body) {
  const pedidos = Array.isArray(body) ? body : (body.data || []);
  if (!pedidos.length) return { success: false, error: "Array vacío" };

  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Seguimiento talleres");
  if (!sheet) throw new Error("Hoja 'Seguimiento talleres' no encontrada.");

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(2, 1, 1, lastCol).getValues()[0];

  // Construir mapa: fieldName normalizado → columna 1-based
  const headerColMap = {};
  headers.forEach((h, i) => {
    if (h) headerColMap[normalizeString(String(h))] = i + 1;
  });

  let inserted = 0;
  let skipped = 0;
  const data = getSheetData(sheet, 2);

  // Índice de IDs existentes para no duplicar
  const existingIds = new Set(
    data.map(r => normalizeKey(r.ncotizacion || r.nproyecto || r.pedidoid || ""))
  );

  pedidos.forEach(p => {
    const pid = normalizeKey(p.pedido_id || p.id || "");
    if (!pid || existingIds.has(pid)) { skipped++; return; }

    const newRow = new Array(lastCol).fill("");
    Object.entries(p).forEach(([key, val]) => {
      const colNum = headerColMap[normalizeString(key)];
      if (colNum) newRow[colNum - 1] = val;
    });

    sheet.appendRow(newRow);
    existingIds.add(pid);
    inserted++;
  });

  SpreadsheetApp.flush();

  // Limpiar caché para que el próximo GET traiga datos frescos
  try { CacheService.getScriptCache().remove(CFG.CACHE_KEY); } catch(e) {}

  return { success: true, inserted, skipped };
}

/**
 * INSTRUCCIONES PARA APLICAR EL PATCH:
 * ======================================
 *
 * 1. Abre tu Apps Script → pega TODO este archivo al FINAL del script existente.
 *
 * 2. En tu función doPost, dentro del switch(action), agrega ANTES del `default`:
 *
 *      case "ingestDirectOrders":
 *        result = handleIngestDirectOrders_(body);
 *        break;
 *
 * 3. En tu función doPost, cambia la línea que lee el action para que también
 *    busque en los parámetros URL (fallback para solicitudes legacy):
 *
 *      // ANTES:
 *      const action = body.action;
 *
 *      // DESPUÉS:
 *      const action = body.action || (e.parameter && e.parameter.action) || "";
 *
 * 4. Re-implementar (Implementar → Gestionar → Versión nueva → Implementar).
 *    La URL NO cambia.
 *
 * 5. Ejecuta la función "diagnosticoPatch" para verificar que todo funciona.
 */
function diagnosticoPatch() {
  Logger.log("=== DIAGNÓSTICO PATCH ===");

  // Test 1: colLetterToNum_
  const tests = [["A", 1], ["F", 6], ["J", 10], ["K", 11], ["L", 12], ["AH", 34], ["AI", 35], ["AJ", 36]];
  let ok = true;
  tests.forEach(([letter, expected]) => {
    const got = colLetterToNum_(letter);
    const pass = got === expected;
    if (!pass) ok = false;
    Logger.log(`  ${pass ? "✅" : "❌"} colLetterToNum_("${letter}") = ${got} (esperado: ${expected})`);
  });

  // Test 2: Hoja Seguimiento talleres
  try {
    const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Seguimiento talleres");
    if (sheet) {
      Logger.log("✅ Hoja 'Seguimiento talleres' encontrada");
      Logger.log("  Última fila con datos: " + sheet.getLastRow());
    } else {
      Logger.log("❌ Hoja 'Seguimiento talleres' NO encontrada");
    }
  } catch(e) {
    Logger.log("❌ Error accediendo al spreadsheet: " + e.message);
  }

  Logger.log(ok ? "✅ Patch aplicado correctamente" : "⚠️  Revisa los errores anteriores");
}
