/**
 * Seguridad y Configuración de Criptografía
 * Los valores sensibles se leen desde variables de entorno de Vite.
 * Configura VITE_HMAC_SALT en .env.local (nunca en Git).
 */

export const SECURITY_CONFIG = {
  // Salt para HMAC-SHA256. Se lee desde variable de entorno.
  // Fallback solo para desarrollo local si no está configurado.
  CLIENT_SALT: import.meta.env.VITE_HMAC_SALT || 'dev_fallback_salt_change_in_production',

  // Tiempo máximo antes de considerar los datos como obsoletos (2 horas)
  STALE_DATA_THRESHOLD: 120 * 60 * 1000,
};
