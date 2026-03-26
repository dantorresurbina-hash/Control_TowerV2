import React, { useState, useMemo, useContext, useRef } from 'react';
import { DataContext } from '../context/DataContext';
import {
  Package, Truck, Store, CheckCircle2, Loader2,
  ChevronDown, User, Printer, X, ArrowRight,
  ClipboardList, RefreshCw, AlertTriangle, Box
} from 'lucide-react';

// ── Equipo bodega ────────────────────────────────────────────
const STAFF_BODEGA = [
  'Selecciona tu nombre',
  'Persona 1',
  'Persona 2',
  'Persona 3',
  'Persona 4',
  'Persona 5',
  'Otro',
];

// ── Flujo DIRECTO ────────────────────────────────────────────
const ESTADOS = [
  { id: 'pendiente', label: 'Pendiente',      color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400',    value: 'Pendiente de Armado' },
  { id: 'picking',   label: 'En Picking',     color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500',     value: 'En Picking'           },
  { id: 'packing',   label: 'En Packing',     color: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-500',   value: 'En Packing'           },
  { id: 'despacho',  label: 'Listo Despacho', color: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500',  value: 'Listo Despacho'       },
  { id: 'tienda',    label: 'Listo Retiro',   color: 'bg-purple-100 text-purple-700',  dot: 'bg-purple-500',   value: 'Listo Retiro Tienda'  },
];

const NEXT_ACTIONS = {
  'Pendiente de Armado': [
    { label: 'Iniciar Picking', next: 'En Picking', icon: ClipboardList, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  ],
  'En Picking': [
    { label: 'Pasar a Packing', next: 'En Packing', icon: Box, color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  ],
  'En Packing': [
    { label: 'Listo — Despacho',       next: 'Listo Despacho',      icon: Truck,  color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { label: 'Listo — Retiro Tienda',  next: 'Listo Retiro Tienda', icon: Store,  color: 'bg-purple-600 hover:bg-purple-700 text-white'   },
  ],
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).includes('T') ? v : v + 'T00:00:00');
  if (isNaN(d)) return String(v);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
};

// ── Etiqueta imprimible ──────────────────────────────────────
const PrintLabel = ({ p, bulto, totalBultos, onClose }) => {
  const metodo = p.metodo_entrega || p.canal || '–';
  const doc    = p.documento || '–';
  const isRetiro = /retiro|tienda|oficina/i.test(metodo);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Controles */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 print:hidden">
          <span className="text-sm font-bold text-slate-600">Vista previa etiqueta</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Etiqueta */}
        <div id="label-print" className="border-2 border-dashed border-slate-300 rounded-xl mx-4 mb-4 p-5 print:border-solid print:border-black print:m-0 print:rounded-none">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">N° Pedido</p>
              <p className="text-3xl font-black text-slate-900">#{p.pedido_id || p.id}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bulto</p>
              <p className="text-2xl font-black text-slate-900">{bulto}/{totalBultos}</p>
            </div>
          </div>

          <p className="text-base font-bold text-slate-800 mb-3 leading-tight">{p.nombre_proyecto}</p>

          <div className="border-t border-slate-200 pt-3 space-y-1.5">
            <Row label="Documento"   value={doc} />
            <Row label="Entrega"     value={metodo} highlight={isRetiro ? 'purple' : 'green'} />
            {p.unidades && <Row label="Unidades" value={`${p.unidades} u`} />}
          </div>
        </div>
      </div>

      <style>{`@media print { body > *:not(#label-print) { display: none; } #label-print { display: block !important; border: 2px solid black; margin: 0; padding: 20px; } }`}</style>
    </div>
  );
};

const Row = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11px] text-slate-400 font-medium">{label}</span>
    <span className={`text-sm font-bold rounded-full px-2 py-0.5 ${
      highlight === 'purple' ? 'bg-purple-100 text-purple-700' :
      highlight === 'green'  ? 'bg-emerald-100 text-emerald-700' :
      'text-slate-700'
    }`}>{value}</span>
  </div>
);

// ── Tarjeta de pedido ────────────────────────────────────────
const PedidoCard = ({ p, operario, onAction, updating }) => {
  const [bultos, setBultos]       = useState(1);
  const [showLabel, setShowLabel] = useState(false);
  const [labelBulto, setLabelBulto] = useState(1);

  const estado   = p.estado_produccion || 'Pendiente de Armado';
  const actions  = NEXT_ACTIONS[estado] || [];
  const metodo   = p.metodo_entrega || p.canal || '';
  const isRetiro = /retiro|tienda/i.test(metodo);
  const doc      = p.documento || '';

  const estadoInfo = ESTADOS.find(e => norm(e.value) === norm(estado)) || ESTADOS[0];

  const handlePrint = (bultoNum) => {
    setLabelBulto(bultoNum);
    setShowLabel(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header pedido */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-black text-slate-800">#{p.pedido_id || p.id}</span>
                {isRetiro && (
                  <span className="flex items-center gap-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Store size={9} /> Retiro
                  </span>
                )}
              </div>
              <p className="font-semibold text-slate-700 text-sm truncate">{p.nombre_proyecto}</p>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${estadoInfo.color}`}>
              {estadoInfo.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
            {doc      && <span className="font-medium text-slate-700">{doc}</span>}
            {metodo   && <span>· {metodo}</span>}
            {p.unidades && <span>· {p.unidades} u</span>}
            {p.fecha_retiro_ideal && <span>· Retiro {fmtDate(p.fecha_retiro_ideal)}</span>}
          </div>
        </div>

        {/* Bultos + etiqueta */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
          <span className="text-xs text-slate-500 font-medium">Bultos:</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setBultos(b => Math.max(1, b - 1))} className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">–</button>
            <span className="w-8 text-center font-bold text-slate-800">{bultos}</span>
            <button onClick={() => setBultos(b => b + 1)} className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">+</button>
          </div>
          <div className="flex gap-1.5 ml-auto flex-wrap justify-end">
            {Array.from({ length: bultos }, (_, i) => (
              <button
                key={i}
                onClick={() => handlePrint(i + 1)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg"
              >
                <Printer size={11} /> {i + 1}/{bultos}
              </button>
            ))}
          </div>
        </div>

        {/* Acciones */}
        {actions.length > 0 && (
          <div className="px-4 py-3 flex flex-col gap-2">
            {actions.map(action => (
              <button
                key={action.next}
                disabled={!operario || operario === 'Selecciona tu nombre' || updating === p.pedido_id}
                onClick={() => onAction(p, action.next)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all ${action.color}`}
              >
                {updating === p.pedido_id
                  ? <Loader2 size={16} className="animate-spin" />
                  : <action.icon size={16} />
                }
                {action.label}
              </button>
            ))}
          </div>
        )}

        {(estado === 'Listo Despacho' || estado === 'Listo Retiro Tienda') && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <span className="text-sm font-bold text-emerald-700">
                {estado === 'Listo Retiro Tienda' ? 'Listo para retiro en tienda' : 'Listo para despacho'}
              </span>
            </div>
          </div>
        )}
      </div>

      {showLabel && (
        <PrintLabel
          p={p}
          bulto={labelBulto}
          totalBultos={bultos}
          onClose={() => setShowLabel(false)}
        />
      )}
    </>
  );
};

// ── Página principal ─────────────────────────────────────────
const BodegaMode = () => {
  const { data, updatePedidoStatus, isLoading } = useContext(DataContext);
  const [operario, setOperario] = useState(() => localStorage.getItem('yute_bodega_operario') || 'Selecciona tu nombre');
  const [filtroEstado, setFiltroEstado] = useState('all');
  const [updating, setUpdating] = useState(null);
  const [nombreManual, setNombreManual] = useState('');

  const pedidos = useMemo(() =>
    data.filter(p => norm(p.tipo_flujo) === 'directo' || norm(p.taller) === 'fulfillment directo'),
  [data]);

  const counts = useMemo(() =>
    ESTADOS.reduce((acc, e) => {
      acc[e.id] = pedidos.filter(p => norm(p.estado_produccion || 'Pendiente de Armado') === norm(e.value)).length;
      return acc;
    }, {}),
  [pedidos]);

  const filtered = useMemo(() => {
    if (filtroEstado === 'all') return pedidos.filter(p => {
      const s = norm(p.estado_produccion || '');
      return s !== 'entregado' && s !== 'anulado';
    });
    const estado = ESTADOS.find(e => e.id === filtroEstado);
    return estado ? pedidos.filter(p => norm(p.estado_produccion || 'Pendiente de Armado') === norm(estado.value)) : pedidos;
  }, [pedidos, filtroEstado]);

  const handleAction = async (p, nextEstado) => {
    const id = p.pedido_id || p.id;
    setUpdating(id);
    const nombre = operario === 'Otro' ? nombreManual : operario;
    try {
      await updatePedidoStatus(id, nextEstado, { operario: nombre });
    } finally {
      setUpdating(null);
    }
  };

  const handleOperarioChange = (val) => {
    setOperario(val);
    if (val !== 'Otro') localStorage.setItem('yute_bodega_operario', val);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Package size={20} className="text-emerald-500" />
            <h1 className="text-lg font-black text-slate-800">Modo Bodega</h1>
            <span className="ml-auto text-xs text-slate-400 font-medium">{filtered.length} pedidos</span>
          </div>

          {/* Selector operario */}
          <div className="relative mb-3">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={operario}
              onChange={e => handleOperarioChange(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-semibold outline-none appearance-none ${
                operario === 'Selecciona tu nombre'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              {STAFF_BODEGA.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {operario === 'Otro' && (
            <input
              type="text"
              placeholder="Escribe tu nombre..."
              value={nombreManual}
              onChange={e => { setNombreManual(e.target.value); localStorage.setItem('yute_bodega_operario', e.target.value); }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Tabs por estado */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <TabBtn id="all" label="Todos" count={filtered.length} active={filtroEstado === 'all'} onClick={setFiltroEstado} color="slate" />
            {ESTADOS.slice(0,3).map(e => (
              <TabBtn key={e.id} id={e.id} label={e.label} count={counts[e.id]} active={filtroEstado === e.id} onClick={setFiltroEstado} color={e.id} />
            ))}
            <TabBtn id="despacho" label="Despacho" count={counts.despacho} active={filtroEstado === 'despacho'} onClick={setFiltroEstado} color="despacho" />
            <TabBtn id="tienda" label="Retiro" count={counts.tienda} active={filtroEstado === 'tienda'} onClick={setFiltroEstado} color="tienda" />
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {isLoading && pedidos.length === 0 && (
          <div className="flex justify-center items-center gap-2 py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Cargando pedidos...</span>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <CheckCircle2 size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No hay pedidos en este estado</p>
          </div>
        )}

        {operario === 'Selecciona tu nombre' && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            Selecciona tu nombre para poder actualizar estados
          </div>
        )}

        {filtered.map((p, i) => (
          <PedidoCard
            key={`${p.pedido_id || p.id}-${p.nombre_proyecto}-${i}`}
            p={p}
            operario={operario === 'Otro' ? nombreManual : operario}
            onAction={handleAction}
            updating={updating}
          />
        ))}
      </div>
    </div>
  );
};

const TAB_COLORS = {
  all:       { active: 'bg-slate-700 text-white',      inactive: 'bg-white text-slate-600 border-slate-200' },
  pendiente: { active: 'bg-slate-600 text-white',      inactive: 'bg-white text-slate-600 border-slate-200' },
  picking:   { active: 'bg-blue-600 text-white',       inactive: 'bg-white text-blue-600 border-blue-200'   },
  packing:   { active: 'bg-yellow-500 text-white',     inactive: 'bg-white text-yellow-600 border-yellow-200'},
  despacho:  { active: 'bg-emerald-600 text-white',    inactive: 'bg-white text-emerald-600 border-emerald-200'},
  tienda:    { active: 'bg-purple-600 text-white',     inactive: 'bg-white text-purple-600 border-purple-200' },
};

const TabBtn = ({ id, label, count, active, onClick, color }) => {
  const colors = TAB_COLORS[color] || TAB_COLORS.all;
  return (
    <button
      onClick={() => onClick(id)}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${active ? colors.active : colors.inactive}`}
    >
      {label}
      {count > 0 && (
        <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black ${active ? 'bg-white/30' : 'bg-current/10'}`}>
          {count}
        </span>
      )}
    </button>
  );
};

export default BodegaMode;
