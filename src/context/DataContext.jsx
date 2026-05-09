import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { SECURITY_CONFIG } from '../config/security';

// URL del Google Apps Script — en producción (Vercel) usa el proxy /api/proxy
// para evitar bloqueos CORS de Google. En local usa VITE_GAS_URL directamente.
const SCRIPT_URL = import.meta.env.PROD
  ? '/api/proxy'
  : import.meta.env.VITE_GAS_URL;

if (!SCRIPT_URL) {
  console.warn('[DataContext] VITE_GAS_URL no está configurada. Las sincronizaciones fallarán.');
}

// ============================================================
// UTILIDADES PURAS — exportadas para uso en cualquier componente
// ============================================================

export const cleanId = (id) => String(id || '').replace(/#/g, '').trim();

export const parseNumber = (val) => {
  if (!val && val !== 0) return 0;
  let clean = String(val).trim().replace(/[$%\s]/g, '');
  if (!clean) return 0;
  const dots = (clean.match(/\./g) || []).length;
  const commas = (clean.match(/,/g) || []).length;
  if (dots > 1) return parseFloat(clean.replace(/\./g, ''));
  if (commas > 1) return parseFloat(clean.replace(/,/g, ''));
  if (dots === 1 && commas === 1) {
    return clean.indexOf('.') < clean.indexOf(',')
      ? parseFloat(clean.replace(/\./g, '').replace(',', '.'))
      : parseFloat(clean.replace(/,/g, ''));
  }
  if (dots === 1) {
    const parts = clean.split('.');
    if (parts[1].length === 3) return parseFloat(clean.replace(/\./g, ''));
    return parseFloat(clean);
  }
  if (commas === 1) {
    const parts = clean.split(',');
    if (parts[1].length === 3) return parseFloat(clean.replace(/,/g, ''));
    return parseFloat(clean.replace(',', '.'));
  }
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export const getLocalYMD = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.split('T')[0];
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getTodayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '-';
  try {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

// ============================================================
// CONFIGURACIÓN DE TALLERES
// ============================================================

const getInitialTalleres = () => {
  try {
    const saved = localStorage.getItem('dash_talleres_config');
    if (saved) return JSON.parse(saved);
  } catch { /* ignorar */ }
  return [
    { id: 'T1', nombre: 'Yute Impresiones', capacidad_semanal_impresiones: 20000, direccion: 'Lo Aguirre 1200 Pudahuel', email: 'gacevedo@yute.cl', telefono: '994111596' },
    { id: 'T2', nombre: 'Lidi', capacidad_semanal_impresiones: 15000, direccion: 'Santiago Concha 1324', email: 'produccion@estampadoslidi.cl', telefono: '990486163' },
    { id: 'T3', nombre: 'Pintapack', capacidad_semanal_impresiones: 15000, direccion: 'santa elvira 040 ñuñoa', email: 'produccion@pintapack.cl', telefono: '958817605' },
    { id: 'T4', nombre: 'Romel', capacidad_semanal_impresiones: 10000, direccion: 'PEDRO LEON UGALDE 1322', email: 'serviserigrafmg@gmail.com', telefono: '935266119' },
    { id: 'T5', nombre: 'We Are SpA', capacidad_semanal_impresiones: 10000, direccion: 'Caliche 855, Recoleta', email: 'camsdiseno@gmail.com', telefono: '982936946' },
    { id: 'T6', nombre: 'Ideamania', capacidad_semanal_impresiones: 20000, direccion: 'CHOPIN 3090 SAN JOAQUIN', email: 'mario@ideamania.cl', telefono: '932388065' },
  ];
};

const SYNC_QUEUE_KEY = 'dash_sync_queue';

// ============================================================
// CONTEXT
// ============================================================

export const DataContext = createContext();
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem('dash_data_cache');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(() => {
    const saved = localStorage.getItem('dash_last_sync');
    return saved ? new Date(saved) : null;
  });
  const [isLocalStorage, setIsLocalStorage] = useState(!!localStorage.getItem('dash_data_cache'));
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('dash_role') || 'kam');
  const [talleres, setTalleres] = useState(getInitialTalleres);

  const [syncQueue, setSyncQueue] = useState(() => {
    try {
      const saved = localStorage.getItem(SYNC_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const updateRole = (role) => {
    setUserRole(role);
    sessionStorage.setItem('dash_role', role);
  };

  const updateTalleres = (nuevosTalleres) => {
    setTalleres(nuevosTalleres);
    localStorage.setItem('dash_talleres_config', JSON.stringify(nuevosTalleres));
  };

  // ── FETCH ──────────────────────────────────────────────────
  const fetchData = async () => {
    if (!SCRIPT_URL) {
      setError('VITE_GAS_URL no configurada');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(`${SCRIPT_URL}?ts=${Date.now()}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      const json = await response.json();

      if (json.success && Array.isArray(json.data)) {
        const filteredData = json.data.filter(
          (p) =>
            String(p.estado_produccion || '').toLowerCase() !== 'anulado' &&
            String(p.estado_logistico || '').toLowerCase() !== 'anulado'
        );
        setData([...filteredData]);
        const now = new Date();
        setLastSync(now);
        localStorage.setItem('dash_last_sync', now.toISOString());
        setIsLocalStorage(false);
        try {
          localStorage.setItem('dash_data_cache', JSON.stringify(filteredData));
        } catch {
          console.warn('[Cache] localStorage lleno, no se pudo guardar caché.');
        }
      } else {
        throw new Error(json.error || 'Formato de respuesta inválido');
      }
    } catch (err) {
      console.error('[fetchData] Error:', err.message);
      setError(err.name === 'AbortError' ? 'Timeout: Google tardó demasiado.' : err.message);

      // Usar caché solo si no está obsoleta
      const lastSyncTime = lastSync ? lastSync.getTime() : 0;
      const isStale = Date.now() - lastSyncTime > SECURITY_CONFIG.STALE_DATA_THRESHOLD;
      if (isStale) {
        console.warn('[Cache] Caché obsoleta (>2h). Se muestra igualmente pero puede estar desactualizada.');
      }
      setIsLocalStorage(true);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  // ── HELPER: POST al GAS con formato correcto ──────────────
  // El GAS v3.1 espera: POST con JSON body { action, ...params }
  // y también acepta action en URL params como fallback (legacy).
  const gasPost = async (body, signal) => {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
    return response.json();
  };

  // ── COLA DE SINCRONIZACIÓN OFFLINE ────────────────────────
  useEffect(() => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
  }, [syncQueue]);

  useEffect(() => {
    const processQueue = async () => {
      if (syncQueue.length === 0 || !SCRIPT_URL) return;

      const remainingQueue = [];
      for (const item of syncQueue) {
        try {
          const result = await gasPost({
            action: 'update',
            pedidoId: item.pedidoId,
            estado: item.newStatus || '',
            cells: item.extraData?.cells || {},
            usuario: 'Dashboard (retry)',
          });
          if (!result.success) remainingQueue.push(item);
        } catch {
          remainingQueue.push(item);
        }
      }
      setSyncQueue(remainingQueue);
    };

    const interval = setInterval(processQueue, 15000);
    return () => clearInterval(interval);
  }, [syncQueue]);

  // ── ACTUALIZACIÓN INDIVIDUAL ───────────────────────────────
  const updatePedidoStatus = async (pedidoId, newStatus, extraData = {}) => {
    // Optimistic update local
    setData((prev) =>
      (prev || []).map((p) =>
        cleanId(p.pedido_id || p.id) === cleanId(pedidoId)
          ? { ...p, estado_produccion: newStatus || p.estado_produccion, ...extraData }
          : p
      )
    );

    if (!SCRIPT_URL) {
      setSyncQueue((prev) => [...prev, { pedidoId, newStatus, extraData, timestamp: Date.now() }]);
      return true;
    }

    try {
      // Usar POST con JSON body (formato GAS v3.1)
      const result = await gasPost({
        action: 'update',
        pedidoId,
        estado: newStatus || '',
        cells: extraData.cells || {},
        bultos: extraData.bultos,
        usuario: extraData.usuario || 'Dashboard',
      });
      if (!result.success) throw new Error(result.error || 'Error servidor');
      return true;
    } catch (err) {
      console.error('[updatePedidoStatus] Encolando para reintento:', err.message);
      setSyncQueue((prev) => [...prev, { pedidoId, newStatus, extraData, timestamp: Date.now() }]);
      return true; // Modo offline: éxito local
    }
  };

  // ── ACTUALIZACIÓN EN MASA ──────────────────────────────────
  const updatePedidoStatusBulk = async (updates) => {
    setData((prev) => {
      let newData = [...(prev || [])];
      updates.forEach((u) => {
        newData = newData.map((p) =>
          cleanId(p.pedido_id || p.id) === cleanId(u.pedidoId)
            ? { ...p, estado_produccion: u.estado, ...u.extraData }
            : p
        );
      });
      return newData;
    });

    if (!SCRIPT_URL) {
      updates.forEach((u) =>
        setSyncQueue((prev) => [...prev, { pedidoId: u.pedidoId, newStatus: u.estado, extraData: u.extraData, timestamp: Date.now() }])
      );
      return true;
    }

    try {
      // GAS v3.1 espera: { action: "batch_update", updates: [...] }
      const result = await gasPost({
        action: 'batch_update',
        updates: updates.map((u) => ({
          pedidoId: u.pedidoId,
          estado: u.estado,
          cells: u.extraData?.cells || {},
          usuario: 'Dashboard',
        })),
      });
      return result.success;
    } catch (err) {
      console.error('[updatePedidoStatusBulk] Encolando individualmente:', err.message);
      updates.forEach((u) =>
        setSyncQueue((prev) => [...prev, { pedidoId: u.pedidoId, newStatus: u.estado, extraData: u.extraData, timestamp: Date.now() }])
      );
      return true;
    }
  };

  // ── INGESTA DIRECTA (MANIFIESTOS) ─────────────────────────
  const uploadDirectOrders = async (pedidosArray) => {
    if (!SCRIPT_URL) return { success: false, error: 'VITE_GAS_URL no configurada' };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      // GAS v3.1: se agrega via PATCH.gs como "ingestDirectOrders"
      const result = await gasPost({ action: 'ingestDirectOrders', data: pedidosArray }, controller.signal);
      clearTimeout(timeoutId);
      if (!result.success) throw new Error(result.error || 'Error en el servidor');
      fetchData().catch(console.error);
      return { success: true, inserted: result.inserted };
    } catch (err) {
      clearTimeout(timeoutId);
      return { success: false, error: err.name === 'AbortError' ? 'Timeout en GAS.' : err.message };
    }
  };

  // ── CARGA INICIAL ──────────────────────────────────────────
  useEffect(() => {
    fetchData();
  }, []);

  // ── DATA FILTRADA (sin anulados, sin filas vacías) ─────────
  const pedidosFiltrados = useMemo(
    () =>
      (data || []).filter((p) => {
        if (String(p.estado_produccion || '').toLowerCase() === 'anulado') return false;
        if (String(p.estado_logistico || '').toLowerCase() === 'anulado') return false;
        if (!p.pedido_id || String(p.pedido_id).trim() === '') return false;
        return true;
      }),
    [data]
  );

  return (
    <DataContext.Provider
      value={{
        data: pedidosFiltrados,
        rawData: data,
        isLoading,
        error,
        lastSync,
        isLocalStorage,
        talleres,
        updateTalleres,
        SCRIPT_URL,
        fetchData,
        userRole,
        updateRole,
        updatePedidoStatus,
        updatePedidoStatusBulk,
        uploadDirectOrders,
        syncQueueStatus: syncQueue.length,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
