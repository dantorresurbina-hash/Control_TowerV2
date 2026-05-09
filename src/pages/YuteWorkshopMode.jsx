import React, { useState, useMemo, useEffect } from 'react';
import { useData, parseNumber } from '../context/DataContext';
import {
  Factory, PlayCircle, CheckCircle2, RefreshCw, X, User, Package,
  ClipboardCheck, MessageSquare, Printer, AlertCircle, ChevronDown,
} from 'lucide-react';

// ─── Helpers de color ────────────────────────────────────────────────────────

const getColorHex = (text) => {
  if (!text) return null;
  const clean = String(text).toLowerCase().trim();
  const map = {
    rojo: '#ef4444', azul: '#3b82f6', verde: '#22c55e', amarillo: '#eab308',
    negro: '#001a1a', blanco: '#f1f5f9', gris: '#94a3b8', naranja: '#f97316',
    morado: '#a855f7', purpura: '#a855f7', rosado: '#ec4899', rosa: '#ec4899',
    cafe: '#78350f', marron: '#78350f', celeste: '#0ea5e9', turquesa: '#14b8a6',
    cian: '#06b6d4', magenta: '#d946ef', oro: '#fbbf24', plata: '#cbd5e1',
  };
  for (const [key, hex] of Object.entries(map)) {
    if (clean.includes(key)) return hex;
  }
  const hexMatch = clean.match(/#[0-9a-f]{3,6}/);
  return hexMatch ? hexMatch[0] : null;
};

const ColorSwatch = ({ text }) => {
  const hex = getColorHex(text);
  if (!hex) return null;
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-slate-200 shadow-inner"
      style={{ backgroundColor: hex }}
      title={text}
    />
  );
};

// ─── Badge de estado ──────────────────────────────────────────────────────────

const ESTADO_STYLES = {
  pendiente:       'bg-slate-100 text-slate-600',
  etiquetado:      'bg-blue-100 text-blue-700',
  asignado:        'bg-amber-100 text-amber-700',
  'en proceso':    'bg-indigo-100 text-indigo-700',
  'listo impresor':'bg-purple-100 text-purple-700',
  'listo taller':  'bg-emerald-100 text-emerald-700',
  terminado:       'bg-emerald-100 text-emerald-700',
};

const EstadoBadge = ({ estado }) => {
  const key = Object.keys(ESTADO_STYLES).find((k) => String(estado || '').toLowerCase().includes(k)) || 'pendiente';
  return (
    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wide ${ESTADO_STYLES[key]}`}>
      {estado || 'Pendiente'}
    </span>
  );
};

// ─── Card de pedido ───────────────────────────────────────────────────────────

const PedidoCard = ({ pedido, onClick }) => (
  <button
    onClick={() => onClick(pedido)}
    className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group"
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <div>
        <p className="text-[10px] font-black text-indigo-500 mb-0.5">#{pedido.pedido_id}</p>
        <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-2 group-hover:text-indigo-700 transition-colors">
          {pedido.nombre_proyecto}
        </p>
      </div>
      <EstadoBadge estado={pedido.estado_produccion} />
    </div>

    <div className="grid grid-cols-3 gap-2 mt-3">
      <div className="bg-slate-50 rounded-xl p-2 text-center">
        <p className="text-[9px] font-bold text-slate-400 uppercase">Unid.</p>
        <p className="text-sm font-black text-slate-700">{parseNumber(pedido.unidades).toLocaleString()}</p>
      </div>
      <div className="bg-indigo-50 rounded-xl p-2 text-center">
        <p className="text-[9px] font-bold text-indigo-400 uppercase">Impr.</p>
        <p className="text-sm font-black text-indigo-600">
          {(parseNumber(pedido.impresiones) || parseNumber(pedido.unidades)).toLocaleString()}
        </p>
      </div>
      <div className="bg-slate-50 rounded-xl p-2 text-center">
        <p className="text-[9px] font-bold text-slate-400 uppercase">Bultos</p>
        <p className="text-sm font-black text-slate-700">{pedido.bultos || 1}</p>
      </div>
    </div>

    {pedido.pantone_t && (
      <div className="flex items-center gap-1.5 mt-2">
        <ColorSwatch text={pedido.pantone_t} />
        <span className="text-[10px] text-slate-500 font-medium">{pedido.pantone_t}</span>
      </div>
    )}

    {pedido.fecha_retiro_estimada && (
      <p className="text-[10px] text-slate-400 mt-2 font-medium">
        Retiro estimado: <span className="text-slate-600 font-bold">{pedido.fecha_retiro_estimada}</span>
      </p>
    )}
  </button>
);

// ─── Columna de impresor ──────────────────────────────────────────────────────

const ImpressorColumn = ({ impresor, pedidos, onPedidoClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const enProceso = pedidos.filter((p) =>
    String(p.estado_produccion || '').toLowerCase().includes('proceso')
  ).length;

  return (
    <div className="flex-shrink-0 w-72 bg-slate-50 border border-slate-200 rounded-3xl flex flex-col max-h-full">
      {/* Header columna */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between p-4 border-b border-slate-200 rounded-t-3xl hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600 grid place-items-center text-white font-black text-xs shadow-md">
            {impresor === 'Sin asignar'
              ? <AlertCircle size={16} />
              : impresor.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="text-left">
            <p className="text-sm font-black text-slate-800 leading-tight">{impresor}</p>
            <p className="text-[10px] text-slate-500 font-medium">
              {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
              {enProceso > 0 && <span className="ml-1 text-amber-600 font-bold">· {enProceso} en proceso</span>}
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {/* Lista de pedidos */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pedidos.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin pedidos asignados</p>
          ) : (
            pedidos.map((p) => (
              <PedidoCard key={p.pedido_id} pedido={p} onClick={onPedidoClick} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Modal de detalle ─────────────────────────────────────────────────────────

const YutePedidoModal = ({ pedido, onClose, onUpdateAction, isUpdating, selectedPrinter, selectedPicker, nombreManual }) => {
  const [comentario, setComentario] = useState('');
  const [showComentarioModal, setShowComentarioModal] = useState(false);

  if (!pedido) return null;

  const estado = String(pedido.estado_produccion || '').toLowerCase();
  const isPicking       = !estado || estado.includes('etiquetado') || estado.includes('pendiente');
  const isPickingOk     = estado.includes('asignado');
  const isEnProceso     = estado.includes('proceso');
  const isListoImpresor = estado.includes('impresor');
  const isListoTaller   = estado.includes('taller') || estado.includes('terminado');

  const handleAction = (actionType) => {
    const isPrintAction = actionType === 'start' || actionType === 'finish';
    const nombre = isPrintAction ? selectedPrinter : selectedPicker;
    const finalName = nombre === 'Otro' ? nombreManual : nombre;

    if (!finalName) {
      alert('Por favor selecciona tu nombre en el header antes de continuar.');
      return;
    }
    if (actionType === 'ready_taller' && !showComentarioModal) {
      setShowComentarioModal(true);
      return;
    }
    onUpdateAction(pedido, actionType, finalName, comentario);
    if (showComentarioModal) setShowComentarioModal(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-7 text-white">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                  #{pedido.pedido_id}
                </span>
                <EstadoBadge estado={pedido.estado_produccion} />
                {pedido.impresor && (
                  <span className="bg-indigo-500/30 border border-indigo-400/30 px-3 py-1 rounded-full text-[10px] font-black text-indigo-300 uppercase flex items-center gap-1">
                    <Printer size={10} /> {pedido.impresor}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black tracking-tighter">{pedido.nombre_proyecto}</h2>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all">
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-7 space-y-6 bg-slate-50/50">
          {/* Métricas clave */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Unidades',     value: parseNumber(pedido.unidades).toLocaleString(),                         color: 'text-slate-800' },
              { label: 'Impresiones',  value: (parseNumber(pedido.impresiones) || parseNumber(pedido.unidades)).toLocaleString(), color: 'text-indigo-600' },
              { label: 'Bultos',       value: pedido.bultos || 1,                                                    color: 'text-emerald-600' },
              { label: 'Color Tiro',   value: pedido.pantone_t || '--',                                              color: 'text-slate-700', swatch: pedido.pantone_t },
            ].map(({ label, value, color, swatch }) => (
              <div key={label} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-1">{label}</p>
                <div className="flex items-center gap-1.5">
                  {swatch && <ColorSwatch text={swatch} />}
                  <span className={`text-lg font-black ${color}`}>{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Trazabilidad */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ClipboardCheck size={14} /> Log de Trazabilidad
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Picking (J)',    val: pedido.fecha_envio_taller_diseno },
                { label: 'Operario J',     val: pedido.operario_picking },
                { label: 'VB (K/L)',       val: pedido.vb ? '✅ ' + (pedido.fecha_vb || '') : '❌' },
                { label: 'Impresor (AH)',  val: pedido.impresor,           highlight: true },
                { label: 'Retiro real (F)',val: pedido.fecha_retiro_real },
                { label: 'Retiro est.',    val: pedido.fecha_retiro_estimada },
              ].map(({ label, val, highlight }) => (
                <div key={label} className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 font-bold">{label}</span>
                  <span className={`font-bold ${highlight ? 'text-indigo-600' : 'text-slate-700'}`}>{val || '---'}</span>
                </div>
              ))}
            </div>

            {pedido.comentario_taller && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs">
                <span className="block font-black text-amber-600 mb-1 uppercase tracking-tight">Comentario Calidad:</span>
                <p className="text-amber-800 italic">{pedido.comentario_taller}</p>
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="p-7 bg-white border-t border-slate-100">
          {isUpdating === (pedido.pedido_id || pedido.id) ? (
            <div className="flex items-center justify-center h-16 text-indigo-600 font-bold gap-2">
              <RefreshCw className="animate-spin" size={18} /> Sincronizando con planilla...
            </div>
          ) : (
            <div className="flex gap-3">
              {isPicking && (
                <ActionBtn color="indigo" icon={Package} label="Completar Picking" sub="Entrega a taller (J)" onClick={() => handleAction('picking')} />
              )}
              {isPickingOk && (
                <ActionBtn color="amber" icon={PlayCircle} label="Iniciar Impresión" sub="Inicio taller (K/L)" onClick={() => handleAction('start')} />
              )}
              {isEnProceso && (
                <ActionBtn color="emerald" icon={CheckCircle2} label="Listo Impresor" sub="Retiro taller (F)" onClick={() => handleAction('finish')} />
              )}
              {isListoImpresor && (
                <ActionBtn color="blue" icon={ClipboardCheck} label="Listo Taller" sub="Control de calidad" onClick={() => handleAction('ready_taller')} />
              )}
              {isListoTaller && (
                <div className="flex-1 h-16 bg-slate-100 text-slate-400 rounded-2xl font-black flex items-center justify-center gap-2 border border-slate-200">
                  <CheckCircle2 size={20} /> Pedido completado
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de comentario */}
      {showComentarioModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white p-7 rounded-[2rem] w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <MessageSquare className="text-indigo-600" size={20} /> Reporte Control de Calidad
            </h3>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="w-full h-28 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold resize-none"
              placeholder="Ej: Unidades OK, impresión nítida, empaque revisado..."
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowComentarioModal(false)} className="flex-1 py-3 rounded-2xl font-black text-slate-400 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={() => handleAction('ready_taller')} className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl font-black shadow-lg shadow-indigo-100">
                Guardar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionBtn = ({ color, icon: Icon, label, sub, onClick }) => {
  const colors = {
    indigo:  'bg-indigo-600 shadow-indigo-100',
    amber:   'bg-amber-500 shadow-amber-100',
    emerald: 'bg-emerald-600 shadow-emerald-100',
    blue:    'bg-blue-600 shadow-blue-100',
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 ${colors[color]} text-white h-16 rounded-2xl font-black shadow-xl hover:scale-[1.02] transition-transform flex flex-col items-center justify-center leading-tight`}
    >
      <Icon size={18} className="mb-0.5" />
      <span className="text-sm">{label}</span>
      <span className="text-[9px] opacity-70">{sub}</span>
    </button>
  );
};

// ─── Vista principal ──────────────────────────────────────────────────────────

const STAFF_PICKING   = ['Manuel Cardozo', 'Otro'];
const STAFF_IMPRESION = ['Manuel Cardozo', 'Miguel Palomino', 'Otro'];

const YuteWorkshopMode = () => {
  const { data, updatePedidoStatus } = useData();
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [isUpdating, setIsUpdating]         = useState(null);
  const [selectedPrinter, setSelectedPrinter] = useState(() => localStorage.getItem('yute_printer') || '');
  const [selectedPicker,  setSelectedPicker]  = useState(() => localStorage.getItem('yute_picker')  || '');
  const [nombreManual, setNombreManual]        = useState('');

  useEffect(() => { localStorage.setItem('yute_printer', selectedPrinter); }, [selectedPrinter]);
  useEffect(() => { localStorage.setItem('yute_picker',  selectedPicker);  }, [selectedPicker]);

  // Solo pedidos de Yute que no estén entregados
  const pedidosYute = useMemo(
    () =>
      data.filter((p) => {
        const taller = String(p.taller || '').toLowerCase();
        const estado = String(p.estado_produccion || '').toLowerCase();
        return taller.includes('yute') && !estado.includes('entregado');
      }),
    [data]
  );

  // Agrupar por impresor
  const agrupados = useMemo(() => {
    const groups = {};
    pedidosYute.forEach((p) => {
      const key = p.impresor?.trim() || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    // "Sin asignar" siempre al final
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Sin asignar') return 1;
      if (b === 'Sin asignar') return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [pedidosYute]);

  const handleUpdateAction = async (pedido, action, operarioNombre, comentario = '') => {
    const id = pedido.pedido_id || pedido.id;
    setIsUpdating(id);
    const ahora = new Date().toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    let nextStatus = '';
    let cells = {};

    switch (action) {
      case 'picking':
        nextStatus = 'Asignado';
        cells = { J: ahora, AJ: operarioNombre };
        break;
      case 'start':
        nextStatus = 'En Proceso';
        cells = { K: true, L: ahora, AH: operarioNombre };
        break;
      case 'finish':
        nextStatus = 'Listo Impresor';
        cells = { F: ahora, K: true, L: pedido.fecha_vb || ahora, AH: pedido.impresor || operarioNombre };
        break;
      case 'ready_taller':
        nextStatus = 'Listo Taller';
        cells = { AI: comentario, AJ: operarioNombre };
        break;
      default:
        setIsUpdating(null);
        return;
    }

    await updatePedidoStatus(id, nextStatus, { cells });
    setIsUpdating(null);
    setSelectedPedido(null);
  };

  const showNombreManual = selectedPicker === 'Otro' || selectedPrinter === 'Otro';

  return (
    <div className="h-full flex flex-col gap-5 overflow-hidden">
      {/* ── Header de planta ── */}
      <div className="bg-slate-900 p-6 rounded-3xl text-white flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 shrink-0">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3 tracking-tighter">
            <Factory className="text-indigo-400" size={26} />
            Yute Impresiones — Vista por Impresor
          </h1>
          <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">
            {agrupados.length} impresores · {pedidosYute.length} pedidos activos
          </p>
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          {/* Picker */}
          <SelectorPersonal
            label="Operario Picking / QA"
            color="indigo"
            value={selectedPicker}
            options={STAFF_PICKING}
            onChange={(v) => { setSelectedPicker(v); if (v !== 'Otro') setNombreManual(''); }}
          />
          {/* Impresor */}
          <SelectorPersonal
            label="Impresor"
            color="amber"
            value={selectedPrinter}
            options={STAFF_IMPRESION}
            onChange={(v) => { setSelectedPrinter(v); if (v !== 'Otro') setNombreManual(''); }}
          />
          {/* Campo manual */}
          {showNombreManual && (
            <div className="flex items-center gap-2 bg-indigo-500/20 px-4 py-2 rounded-2xl border border-indigo-500/30 flex-1 min-w-[180px]">
              <div className="flex-1">
                <p className="text-[9px] font-black text-indigo-400 uppercase">Especificar nombre</p>
                <input
                  type="text"
                  value={nombreManual}
                  onChange={(e) => setNombreManual(e.target.value)}
                  placeholder="Escriba aquí..."
                  className="w-full bg-transparent font-bold text-white text-xs outline-none placeholder:text-indigo-300/50"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tablero Kanban por impresor ── */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex gap-4 h-full pb-2">
          {agrupados.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-bold">
              No hay pedidos activos en Yute Impresiones
            </div>
          ) : (
            agrupados.map(([impresor, pedidos]) => (
              <ImpressorColumn
                key={impresor}
                impresor={impresor}
                pedidos={pedidos}
                onPedidoClick={setSelectedPedido}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal de detalle */}
      {selectedPedido && (
        <YutePedidoModal
          pedido={selectedPedido}
          onClose={() => setSelectedPedido(null)}
          isUpdating={isUpdating}
          onUpdateAction={handleUpdateAction}
          selectedPrinter={selectedPrinter}
          selectedPicker={selectedPicker}
          nombreManual={nombreManual}
        />
      )}
    </div>
  );
};

// Sub-componente selector de personal
const SelectorPersonal = ({ label, color, value, options, onChange }) => {
  const colors = { indigo: 'text-indigo-400', amber: 'text-amber-400' };
  return (
    <div className={`flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 flex-1 min-w-[190px]`}>
      <User size={15} className={colors[color]} />
      <div className="flex-1">
        <p className="text-[9px] font-black text-slate-500 uppercase">{label}</p>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent font-bold text-white text-xs outline-none cursor-pointer"
        >
          <option value="" className="text-slate-900">Seleccionar...</option>
          {options.map((o) => (
            <option key={o} value={o} className="text-slate-900">{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default YuteWorkshopMode;
