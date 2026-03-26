# Setup Google Apps Script → DASH3

## Paso 1: Abrir el editor de Apps Script

1. Abre tu hoja de Google Sheets
2. En el menú superior: **Extensiones → Apps Script**
3. Se abre una nueva pestaña con el editor

## Paso 2: Pegar el script

1. Borra todo el contenido del editor (Ctrl+A, Delete)
2. Copia el contenido de `Code.gs` y pégalo
3. Haz clic en 💾 **Guardar** (Ctrl+S)

## Paso 3: Verificar que encuentra tu hoja

Antes de deployar, verifica que el script detecta bien tus columnas:

1. En el menú desplegable de funciones, selecciona **`diagnostico`**
2. Haz clic en **▶ Ejecutar**
3. Acepta los permisos si te lo pide
4. En el panel inferior "Registros de ejecución" deberías ver:
   ```
   ✅ Hoja encontrada: [nombre de tu pestaña]
   ✅ Columna de ID encontrada en col [número]
   ```

### Si ves ❌ "Columna de ID NO encontrada":
Abre tu hoja y revisa el texto exacto del encabezado donde tienes el ID del pedido.
Luego en el script, cambia esta línea:
```javascript
PEDIDO_ID_HEADER: 'pedido_id',  // ← Reemplaza con el encabezado exacto de tu hoja
```

Por ejemplo, si tu encabezado es `"N° Pedido"`:
```javascript
PEDIDO_ID_HEADER: 'n° pedido',  // lowercase
```

## Paso 4: Deployar como API web

1. Clic en **"Implementar"** → **"Nueva implementación"**
2. Haz clic en el ⚙️ engranaje → selecciona **"Aplicación web"**
3. Configura:
   - **Descripción**: `DASH3 API v1`
   - **Ejecutar como**: `Yo (tu-email@gmail.com)`
   - **Quién puede acceder**: `Cualquier persona`
4. Clic en **"Implementar"**
5. Acepta los permisos
6. **Copia la URL** que aparece — se ve así:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

## Paso 5: Configurar en Vercel

Ve a tu proyecto en Vercel → Settings → Environment Variables y agrega:

| Variable | Valor |
|----------|-------|
| `VITE_GAS_URL` | La URL del paso anterior |
| `VITE_HMAC_SALT` | Un string aleatorio largo (ver abajo) |
| `VITE_ADMIN_PIN_HASH` | El hash SHA256 de tu PIN (ver abajo) |

### Generar VITE_HMAC_SALT
En tu terminal Mac:
```bash
openssl rand -hex 32
```

### Generar VITE_ADMIN_PIN_HASH
En la consola del navegador (F12):
```javascript
// Instala CryptoJS temporalmente o usa este one-liner:
const msgBuffer = new TextEncoder().encode("TU_PIN_AQUI");
const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
const hashArray = Array.from(new Uint8Array(hashBuffer));
console.log(hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
```
Copia el resultado como valor de `VITE_ADMIN_PIN_HASH`.

## Paso 6: Redeploy en Vercel

Después de agregar las variables → **Deployments → Redeploy** (con el último commit).

---

## Actualizar el script en el futuro

Cuando hagas cambios al script:
1. Clic en "Implementar" → "Gestionar implementaciones"
2. Edita la implementación existente → cambia "Versión" a "Versión nueva"
3. Clic en "Implementar"
4. La URL **no cambia** — no necesitas actualizar Vercel

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| "Script error" en consola | Permisos no aceptados | Ejecuta `diagnostico` en el editor y acepta permisos |
| Datos no aparecen | PEDIDO_ID_HEADER incorrecto | Ejecuta `diagnostico` y ajusta el config |
| Datos desactualizados | Cache del browser | El dashboard ya usa `cache: 'no-store'` — espera 1-2 min |
| 401 / 403 | GAS no publicado para "Cualquier persona" | Revisa Paso 4.3 |
| URL en blank Vercel | VITE_GAS_URL no configurada | Verifica que la variable existe en Vercel y redeployaste |
