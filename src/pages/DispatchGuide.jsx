import React, { useState, useMemo } from 'react';
import { useData, formatDateDisplay } from '../context/DataContext';
import { jsPDF } from 'jspdf';
import {
  FileText, Search, Filter, X, Download, Package,
  ChevronDown, CheckSquare, Square, Truck, Phone, Mail, MapPin,
  ClipboardCheck, CheckCircle, AlertCircle, Loader2, User, MessageSquare
} from 'lucide-react';

const ESTADOS_PRODUCCION = ['Todos', 'Pre-prensa', 'En Proceso', 'Listo Taller', 'Terminado', 'Entregado', 'Atrasado', 'Retirado', 'Asignado', 'Etiquetado', 'Pendiente', 'Finalizado', 'Anulado'];
const ESTADOS_LOGISTICO  = ['Todos', 'Esperando Taller', 'Pendiente Retiro', 'Listo para Despacho', 'Despachado', 'En Espera VB', 'Recibido Taller', 'Anulado'];

function agruparPorTaller(proyectos, talleres) {
  const grupos = {};
  proyectos.forEach(p => {
    const nombreTaller = p.taller || 'Sin Taller';
    if (!grupos[nombreTaller]) {
      const info = talleres.find(t => t.nombre.toLowerCase() === nombreTaller.toLowerCase()) || null;
      grupos[nombreTaller] = { info, proyectos: [] };
    }
    grupos[nombreTaller].proyectos.push(p);
  });
  return grupos;
}

function generarNroGuia() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `GD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function generarPDFTaller(nombreTaller, infoTaller, proyectos) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const marginX = 14;
  const contentW = W - marginX * 2;
  const nroGuia = generarNroGuia();
  const fechaHoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, W, 30, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('GUÍA DE DESPACHO', marginX, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`N° ${nroGuia}`, marginX, 20);
  doc.text(`Fecha: ${fechaHoy}`, marginX, 26);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text('YUTE NATURAL', W - marginX, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Control Tower Operativo', W - marginX, 20, { align: 'right' });

  let y = 38;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, y, contentW, infoTaller ? 28 : 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('TALLER DESTINO', marginX + 4, y + 6);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(nombreTaller.toUpperCase(), marginX + 4, y + 14);
  if (infoTaller) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const parts = [];
    if (infoTaller.direccion) parts.push(infoTaller.direccion);
    if (infoTaller.telefono)  parts.push(`Tel: ${infoTaller.telefono}`);
    if (infoTaller.email)     parts.push(infoTaller.email);
    doc.text(parts.join('   •   '), marginX + 4, y + 22);
    y += 28;
  } else {
    y += 16;
  }

  y += 8;
  const totalUnidades = proyectos.reduce((s, p) => s + (Number(p.unidades) || 0), 0);
  const totalBultos   = proyectos.reduce((s, p) => s + (Number(p.bultos) || 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`${proyectos.length} proyecto${proyectos.length !== 1 ? 's' : ''}`, marginX, y);
  doc.text(`${totalUnidades.toLocaleString('es-CL')} unidades totales`, marginX + 40, y);
  if (totalBultos > 0) doc.text(`${totalBultos} bultos`, marginX + 110, y);

  y += 6;
  const cols = [
    { label: 'N°',              w: 8,  align: 'center' },
    { label: 'ID Pedido',       w: 22, align: 'left' },
    { label: 'Nombre Proyecto', w: 58, align: 'left' },
    { label: 'SKU',             w: 22, align: 'left' },
    { label: 'Unidades',        w: 18, align: 'right' },
    { label: 'Bultos',          w: 14, align: 'right' },
    { label: 'Observaciones',   w: 40, align: 'left' },
  ];

  doc.setFillColor(30, 41, 59);
  doc.rect(marginX, y, contentW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  let colX = marginX + 2;
  cols.forEach(col => {
    if (col.align === 'right')       doc.text(col.label, colX + col.w - 2, y + 5.5, { align: 'right' });
    else if (col.align === 'center') doc.text(col.label, colX + col.w / 2, y + 5.5, { align: 'center' });
    else                             doc.text(col.label, colX, y + 5.5);
    colX += col.w;
  });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  proyectos.forEach((p, idx) => {
    const rowH = 9;
    if (y + rowH > 255) { doc.addPage(); y = 20; }
    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.rect(marginX, y, contentW, rowH, 'F');
    doc.setTextColor(15, 23, 42);
    colX = marginX + 2;
    const cells = [
      { val: String(idx + 1),                                     col: cols[0] },
      { val: String(p.pedido_id || '-'),                          col: cols[1] },
      { val: p.nombre_proyecto || '-',                            col: cols[2] },
      { val: p.sku || '-',                                        col: cols[3] },
      { val: (Number(p.unidades) || 0).toLocaleString('es-CL'),  col: cols[4] },
      { val: String(p.bultos || '-'),                             col: cols[5] },
      { val: p.comentario_kam || '',                              col: cols[6] },
    ];
    cells.forEach(({ val, col }) => {
      const truncated = doc.splitTextToSize(val, col.w - 2)[0] || '';
      if (col.align === 'right')       doc.text(truncated, colX + col.w - 2, y + 6, { align: 'right' });
      else if (col.align === 'center') doc.text(truncated, colX + col.w / 2, y + 6, { align: 'center' });
      else                             doc.text(truncated, colX, y + 6);
      colX += col.w;
    });
    if (p.fecha_retiro_ideal) {
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`Retiro: ${formatDateDisplay(p.fecha_retiro_ideal)}`, marginX + 30, y + rowH - 1.5);
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, y + rowH, marginX + contentW, y + rowH);
    y += rowH;
  });

  y += 16;
  if (y + 45 > 280) { doc.addPage(); y = 20; }
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, marginX + contentW, y);
  y += 10;
  const rx = marginX + contentW / 2 + 8;
  [{ label: 'ENTREGADO POR', x: marginX }, { label: 'RECIBIDO POR', x: rx }].forEach(({ label, x }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Nombre: _________________________________', x, y + 10);
    doc.text('RUT: ____________________________________', x, y + 18);
    doc.text('Firma: __________________________________', x, y + 26);
    doc.text('Fecha/Hora: _____________________________', x, y + 34);
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Control Tower Operativo • Yute Natural • ${nroGuia} • Pág ${i}/${pageCount}`, W / 2, 292, { align: 'center' });
  }

  doc.save(`Guia-Despacho-${nombreTaller.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── MODAL DE CONFIRMACIÓN DE RECEPCIÓN ─────────────────────────────────────
function ReceiptModal({ nombreTaller, proyectos, onClose, onConfirm }) {
  const [recibidoPor, setRecibidoPor] = useState('');
  const [notas, setNotas] = useState('');
  const [checked, setChecked] = useState(() => new Set(proyectos.map(p => p.pedido_id)));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const toggleCheck = (id) => setChecked(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleConfirm = async () => {
    setSaving(true);
    const proyectosConfirmados = proyectos.filter(p => checked.has(p.pedido_id));
    await onConfirm(proyectosConfirmados, recibidoPor.trim(), notas.trim());
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 1400);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/15 rounded-lg">
              <ClipboardCheck className="text-emerald-400 w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Confirmar Recepción</p>
              <p className="text-xs text-slate-500 mt-0.5">{nombreTaller}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-bold text-white">Recepción registrada</p>
              <p className="text-xs text-slate-500">{checked.size} proyecto{checked.size !== 1 ? 's' : ''} marcados como recibidos</p>
            </div>
          ) : (
            <>
              {/* Proyectos */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Proyectos despachados ({proyectos.length})
                </p>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {proyectos.map(p => (
                    <button
                      key={p.pedido_id}
                      onClick={() => toggleCheck(p.pedido_id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                        checked.has(p.pedido_id)
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-slate-800/40 border-slate-700/50 opacity-50'
                      }`}
                    >
                      {checked.has(p.pedido_id)
                        ? <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        : <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-mono text-indigo-400">#{p.pedido_id}</span>
                        <span className="text-xs text-slate-300 ml-2 truncate">{p.nombre_proyecto}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {(Number(p.unidades) || 0).toLocaleString('es-CL')} uds
                      </span>
                    </button>
                  ))}
                </div>
                {checked.size < proyectos.length && (
                  <div className="mt-2 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-300">
                      {proyectos.length - checked.size} proyecto{proyectos.length - checked.size !== 1 ? 's' : ''} no confirmado{proyectos.length - checked.size !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Recibido por */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  <User className="w-3 h-3 inline mr-1" />Recibido por (opcional)
                </label>
                <input
                  type="text"
                  value={recibidoPor}
                  onChange={e => setRecibidoPor(e.target.value)}
                  placeholder="Nombre de quien recibió en taller"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  <MessageSquare className="w-3 h-3 inline mr-1" />Observaciones (opcional)
                </label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: Faltó 1 caja del pedido #12345, se coordinó reenvío"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              {/* Botón confirmar */}
              <button
                onClick={handleConfirm}
                disabled={saving || checked.size === 0}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  saving || checked.size === 0
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'
                }`}
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
                  : <><CheckCircle className="w-4 h-4" /> Confirmar {checked.size} proyecto{checked.size !== 1 ? 's' : ''} recibido{checked.size !== 1 ? 's' : ''}</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
const DispatchGuide = () => {
  const { data, talleres, updatePedidoStatus } = useData();
  const [search, setSearch] = useState('');
  const [filterTaller, setFilterTaller] = useState('Todos');
  const [filterEstadoProd, setFilterEstadoProd] = useState('Todos');
  const [filterEstadoLog, setFilterEstadoLog] = useState('Todos');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [receiptModal, setReceiptModal] = useState(null); // { nombreTaller, info, proyectos }
  const [receiptLog, setReceiptLog] = useState({}); // { [nombreTaller]: { ts, count, by } }

  const proyectosBase = useMemo(() =>
    data.filter(p => p.taller && p.taller.trim() !== '' && p.estado_produccion !== 'Anulado'),
    [data]
  );

  const talleresUnicos = useMemo(() => {
    const names = [...new Set(proyectosBase.map(p => p.taller))].sort();
    return ['Todos', ...names];
  }, [proyectosBase]);

  const proyectosFiltrados = useMemo(() => {
    return proyectosBase.filter(p => {
      if (filterTaller !== 'Todos' && p.taller !== filterTaller) return false;
      if (filterEstadoProd !== 'Todos' && p.estado_produccion !== filterEstadoProd) return false;
      if (filterEstadoLog !== 'Todos' && p.estado_logistico !== filterEstadoLog) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          String(p.pedido_id || '').toLowerCase().includes(q) ||
          (p.nombre_proyecto || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [proyectosBase, filterTaller, filterEstadoProd, filterEstadoLog, search]);

  const selectedProyectos = useMemo(() =>
    proyectosBase.filter(p => selected.has(p.pedido_id)),
    [proyectosBase, selected]
  );

  const gruposPorTaller = useMemo(() =>
    agruparPorTaller(selectedProyectos, talleres),
    [selectedProyectos, talleres]
  );

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    const ids = proyectosFiltrados.map(p => p.pedido_id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const allVisibleSelected = proyectosFiltrados.length > 0 &&
    proyectosFiltrados.every(p => selected.has(p.pedido_id));

  const handleConfirmReceipt = async (proyectosConfirmados, recibidoPor, notas) => {
    const fecha = new Date().toISOString();
    await Promise.all(
      proyectosConfirmados.map(p =>
        updatePedidoStatus(p.pedido_id, 'En Proceso', {
          estado_logistico: 'Recibido Taller',
          recibido_por: recibidoPor || 'Sin registrar',
          fecha_recepcion_taller: fecha,
          ...(notas ? { comentario_recepcion: notas } : {}),
        })
      )
    );
    setReceiptLog(prev => ({
      ...prev,
      [receiptModal.nombreTaller]: {
        ts: fecha,
        count: proyectosConfirmados.length,
        by: recibidoPor || null,
      }
    }));
  };

  const estadoColor = (estado) => {
    if (!estado) return 'text-slate-500';
    const e = estado.toLowerCase();
    if (e.includes('proceso') || e.includes('imprimiendo')) return 'text-blue-400';
    if (e.includes('listo') || e.includes('terminado'))      return 'text-emerald-400';
    if (e.includes('atrasado'))                               return 'text-red-400';
    if (e.includes('retiro') || e.includes('despacho'))      return 'text-amber-400';
    return 'text-slate-400';
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Truck className="text-indigo-400 w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Guías de Despacho</h1>
            <p className="text-xs text-slate-500 mt-0.5">Selecciona proyectos y genera la guía PDF por taller</p>
          </div>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              <span className="font-bold text-white">{selected.size}</span> proyecto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
            </span>
            <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
              <X className="w-3 h-3" /> Limpiar
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── PANEL IZQUIERDO ── */}
        <div className="w-[55%] flex flex-col border-r border-slate-800 min-h-0">
          <div className="p-4 border-b border-slate-800/60 space-y-3 flex-shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por ID, nombre o SKU..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                  showFilters || filterTaller !== 'Todos' || filterEstadoProd !== 'Todos' || filterEstadoLog !== 'Todos'
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
                <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Taller', value: filterTaller, set: setFilterTaller, opts: talleresUnicos },
                  { label: 'Estado Producción', value: filterEstadoProd, set: setFilterEstadoProd, opts: ESTADOS_PRODUCCION },
                  { label: 'Estado Logístico', value: filterEstadoLog, set: setFilterEstadoLog, opts: ESTADOS_LOGISTICO },
                ].map(({ label, value, set, opts }) => (
                  <div key={label}>
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">{label}</label>
                    <select
                      value={value}
                      onChange={e => set(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
                    >
                      {opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                {allVisibleSelected
                  ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                  : <Square className="w-4 h-4" />
                }
                {allVisibleSelected ? 'Deseleccionar todos' : 'Seleccionar todos visibles'}
              </button>
              <span className="text-xs text-slate-600">{proyectosFiltrados.length} resultado{proyectosFiltrados.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {proyectosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                <Package className="w-10 h-10" />
                <p className="text-sm">No hay proyectos que coincidan con los filtros</p>
              </div>
            ) : (
              proyectosFiltrados.map(p => {
                const isChecked = selected.has(p.pedido_id);
                return (
                  <button
                    key={p.pedido_id}
                    onClick={() => toggleSelect(p.pedido_id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 text-left transition-colors hover:bg-slate-800/40 ${
                      isChecked ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isChecked
                        ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                        : <Square className="w-4 h-4 text-slate-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[11px] font-bold text-indigo-400 font-mono">#{p.pedido_id}</span>
                        <span className={`text-[10px] font-semibold ${estadoColor(p.estado_produccion)}`}>
                          {p.estado_produccion || '-'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200 truncate leading-snug">
                        {p.nombre_proyecto || 'Sin nombre'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[10px] text-slate-500">{p.taller}</span>
                        {p.sku && <span className="text-[10px] text-slate-600">SKU: {p.sku}</span>}
                        {p.unidades && <span className="text-[10px] text-slate-600">{Number(p.unidades).toLocaleString('es-CL')} uds</span>}
                        {p.fecha_retiro_ideal && (
                          <span className="text-[10px] text-slate-600">Retiro: {formatDateDisplay(p.fecha_retiro_ideal)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── PANEL DERECHO ── */}
        <div className="w-[45%] flex flex-col min-h-0">
          {selected.size === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-700 gap-4 p-8">
              <FileText className="w-14 h-14" />
              <div className="text-center">
                <p className="text-base font-semibold text-slate-500">Sin proyectos seleccionados</p>
                <p className="text-sm text-slate-700 mt-1">Selecciona proyectos del panel izquierdo para generar la guía de despacho</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Guías a generar ({Object.keys(gruposPorTaller).length} taller{Object.keys(gruposPorTaller).length !== 1 ? 'es' : ''})
              </h2>

              {Object.entries(gruposPorTaller).map(([nombreTaller, grupo]) => {
                const { info, proyectos } = grupo;
                const totalUds = proyectos.reduce((s, p) => s + (Number(p.unidades) || 0), 0);
                const log = receiptLog[nombreTaller];

                return (
                  <div key={nombreTaller} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    {/* Header taller */}
                    <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-800">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{nombreTaller}</p>
                          {info && (
                            <div className="mt-1 space-y-0.5">
                              {info.direccion && (
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{info.direccion}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                                {info.telefono && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <Phone className="w-3 h-3" />{info.telefono}
                                  </div>
                                )}
                                {info.email && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <Mail className="w-3 h-3" /><span className="truncate">{info.email}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-white">{proyectos.length} proy.</p>
                          <p className="text-[10px] text-slate-500">{totalUds.toLocaleString('es-CL')} uds</p>
                        </div>
                      </div>
                    </div>

                    {/* Confirmación de recepción registrada */}
                    {log && (
                      <div className="px-4 py-2 flex items-center gap-2 bg-emerald-500/10 border-b border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <p className="text-[11px] text-emerald-300">
                          Recepción confirmada — {log.count} proyecto{log.count !== 1 ? 's' : ''}
                          {log.by ? ` · ${log.by}` : ''}
                          {' · '}{new Date(log.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}

                    {/* Lista proyectos */}
                    <div className="divide-y divide-slate-800/50">
                      {proyectos.map((p, i) => (
                        <div key={p.pedido_id} className="flex items-center gap-2 px-4 py-2">
                          <span className="text-[10px] text-slate-600 w-4 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-indigo-400">#{p.pedido_id}</span>
                              <span className="text-xs text-slate-300 truncate">{p.nombre_proyecto}</span>
                            </div>
                            {p.sku && <span className="text-[10px] text-slate-600">SKU: {p.sku}</span>}
                          </div>
                          <span className="text-[10px] text-slate-500 flex-shrink-0">
                            {(Number(p.unidades) || 0).toLocaleString('es-CL')} uds
                          </span>
                          <button
                            onClick={() => toggleSelect(p.pedido_id)}
                            className="flex-shrink-0 text-slate-700 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Acciones */}
                    <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
                      <button
                        onClick={() => generarPDFTaller(nombreTaller, info, proyectos)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors active:scale-[0.98]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Generar PDF
                      </button>
                      <button
                        onClick={() => setReceiptModal({ nombreTaller, info, proyectos })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-colors active:scale-[0.98] border ${
                          log
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {log ? 'Recepción ✓' : 'Confirmar Recepción'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación */}
      {receiptModal && (
        <ReceiptModal
          nombreTaller={receiptModal.nombreTaller}
          proyectos={receiptModal.proyectos}
          onClose={() => setReceiptModal(null)}
          onConfirm={handleConfirmReceipt}
        />
      )}
    </div>
  );
};

export default DispatchGuide;
