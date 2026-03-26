import React, { useState, useMemo, useContext } from 'react';
import { DataContext, cleanId } from '../context/DataContext';
import { Search, X, ChevronRight, Package, AlertTriangle, Zap, Clock, CheckCircle2, Factory, Loader2 } from 'lucide-react';
import QuickUpdate from './QuickUpdate';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const STATUS_COLORS = {
  'asignado':         'bg-blue-100 text-blue-700',
  'en proceso':       'bg-yellow-100 text-yellow-700',
  'listo impresor':   'bg-orange-100 text-orange-700',
  'listo taller':     'bg-emerald-100 text-emerald-700',
  'entregado':        'bg-slate-100 text-slate-500',
  'pasar correo':     'bg-purple-100 text-purple-700',
  'en produccion':    'bg-yellow-100 text-yellow-700',
  'pendiente de armado': 'bg-red-100 text-red-700',
};

const statusColor = (s) => STATUS_COLORS[norm(s)] || 'bg-slate-100 text-slate-600';

const isExpress = (p) => /express/i.test([p.nombre_proyecto, p.info_adicional].join(' '));

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).includes('T') ? v : v + 'T00:00:00');
  if (isNaN(d)) return String(v);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
};

// ── Tarjeta de resultado de búsqueda ─────────────────────────
const PedidoCard = ({ p, onClick }) => {
  const express = isExpress(p);
  const retiro  = fmtDate(p.fecha_retiro_ideal || p.fecha_retiro_real);
  const estado  = p.estado_produccion || '–';

  return (
    <button
      onClick={() => onClick(p)}
      className="w-full text-left bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-4 hover:border-blue-300 hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-slate-800 text-sm">#{cleanId(p.pedido_id || p.id)}</span>
          {express && (
            <span className="flex items-center gap-0.5 bg-red-100 text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">
              <Zap size={9} /> EXPRESS
            </span>
          )}
        </div>
        <p className="font-semibold text-slate-700 truncate">{p.nombre_proyecto || '–'}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {p.sku && <span className="text-xs text-slate-400">{p.sku}</span>}
          {p.unidades && <span className="text-xs text-slate-400">· {p.unidades} u</span>}
          {p.taller && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Factory size={10} /> {p.taller}
            </span>
          )}
          {retiro && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={10} /> {retiro}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusColor(estado)}`}>
          {estado}
        </span>
        <ChevronRight size={16} className="text-slate-300" />
      </div>
    </button>
  );
};

// ── Detalle ampliado del pedido ───────────────────────────────
const PedidoDetail = ({ p }) => {
  const fields = [
    { label: 'Taller',          value: p.taller },
    { label: 'SKU',             value: p.sku },
    { label: 'Familia',         value: p.familia },
    { label: 'Unidades',        value: p.unidades },
    { label: 'Vendedor',        value: p.vendedor },
    { label: 'Método entrega',  value: p.metodo_entrega },
    { label: 'Estado logístico',value: p.estado_logistico },
    { label: 'Documento',       value: p.documento },
    { label: 'Retiro taller',   value: fmtDate(p.fecha_retiro_ideal) },
    { label: 'Retiro real',     value: fmtDate(p.fecha_retiro_real) },
    { label: 'Fecha entrega',   value: fmtDate(p.fecha_entrega) },
    { label: 'Dim. Tiro',       value: p.dim_t || p.tamano_cara_a },
    { label: 'Pantone Tiro',    value: p.pantone_t || p.colores_a },
    { label: 'Dim. Retiro',     value: p.dim_r || p.tamano_cara_b },
    { label: 'Pantone Retiro',  value: p.pantone_r || p.colores_b },
    { label: 'Posicionamiento', value: p.posicionamiento },
    { label: 'Info adicional',  value: p.info_adicional },
    { label: 'Comentario taller', value: p.comentario_taller },
    { label: 'Comentario KAM',  value: p.comentario_kam },
  ].filter(f => f.value);

  if (fields.length === 0) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ficha del pedido</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {fields.map(f => (
          <div key={f.label}>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{f.label}</p>
            <p className="text-sm font-medium text-slate-700 break-words">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Página principal ─────────────────────────────────────────
const OpsSearch = () => {
  const { data, isLoading } = useContext(DataContext);
  const [query, setQuery]     = useState('');
  const [selected, setSelected] = useState(null);

  const results = useMemo(() => {
    const q = norm(query);
    if (!q || q.length < 2) return [];
    return data.filter(p => {
      const id   = norm(p.pedido_id || p.id || '');
      const name = norm(p.nombre_proyecto || '');
      const sku  = norm(p.sku || '');
      return id.includes(q) || name.includes(q) || sku.includes(q);
    }).slice(0, 20);
  }, [data, query]);

  // Vista de pedido seleccionado
  if (selected) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header con botón volver */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-blue-600 font-semibold text-sm"
          >
            ← Volver
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 truncate text-sm">
              #{cleanId(selected.pedido_id || selected.id)} · {selected.nombre_proyecto}
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
          {/* Ficha ampliada */}
          <PedidoDetail p={selected} />
          {/* Acciones (reutiliza QuickUpdate) */}
          <QuickUpdate pedidoId={selected.pedido_id || selected.id} />
        </div>
      </div>
    );
  }

  // Vista de búsqueda
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-5 pt-8 pb-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Package size={22} className="text-blue-500" />
            <h1 className="text-xl font-bold text-slate-800">Buscar Pedido</h1>
          </div>
          <p className="text-slate-400 text-sm mb-4">Busca por N° pedido, nombre de proyecto o SKU</p>

          {/* Input de búsqueda */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              inputMode="search"
              placeholder="Ej: 109741 · Far Shoes · BC01C"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-2">
        {isLoading && data.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Cargando pedidos...</span>
          </div>
        )}

        {!isLoading && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No se encontraron pedidos para <strong>"{query}"</strong></p>
          </div>
        )}

        {query.length < 2 && !isLoading && (
          <div className="text-center py-12 text-slate-300">
            <Search size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Escribe al menos 2 caracteres para buscar</p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className="text-xs text-slate-400 px-1">{results.length} resultado{results.length !== 1 ? 's' : ''}</p>
            {results.map((p, i) => (
              <PedidoCard
                key={`${p.pedido_id || p.id}-${p.nombre_proyecto}-${i}`}
                p={p}
                onClick={setSelected}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default OpsSearch;
