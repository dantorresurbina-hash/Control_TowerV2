import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useData } from '../context/DataContext';
import {
  Mail, Send, ExternalLink, AlertTriangle, CheckCircle2,
  RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff,
  Paperclip, X, Upload, FileText
} from 'lucide-react';

// ── Mirror de TALLER_MAP del script GAS BotBot ──────────────
const CC_ALWAYS = ['diseno@yute.cl'];
const TALLER_EMAILS = {
  'YUTE IMPRESIONES': { to: 'gacevedo@yute.cl',             cc: [] },
  'LIDI':             { to: 'produccion@estampadoslidi.cl',  cc: [] },
  'PINTAPACK':        { to: 'produccion@pintapack.cl',       cc: ['ventas@pintapack.cl'] },
  'ROMEL':            { to: 'serviserigrafmg@gmail.com',     cc: [] },
  'WE ARE SPA':       { to: 'camsdiseno@gmail.com',          cc: [] },
  'IDEAMANIA':        { to: 'mario@ideamania.cl',            cc: ['produccion@ideamania.cl', 'ventas@ideamania.cl', 'logisticaideamania@gmail.com'] },
};

// ── Utilidades ───────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const fmtDateDM = (v) => {
  if (!v) return '';
  const d = typeof v === 'string'
    ? new Date(v.includes('T') ? v : v + 'T00:00:00')
    : new Date(v);
  if (!isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})/);
  return m ? `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}` : '';
};

const isExpress = (p) =>
  /express/i.test([p.nombre_proyecto, p.info_adicional, p.documentos].join(' '));

const buildSubject = (p) => {
  const fechaDM = fmtDateDM(p.fecha_retiro_ideal || p.fecha_retiro_taller_ideal || p.fecha_entrega_cliente);
  const parts = [p.nombre_proyecto, p.sku, p.unidades ? `${p.unidades} u` : null, fechaDM].filter(Boolean);
  const base = parts.join(' – ');
  return isExpress(p)
    ? `🚨 EXPRESS – ${p.pedido_id} – ${base}`
    : `${p.pedido_id} – ${base}`;
};

const buildBody = (p, tallerNombre) => {
  const fechaDM = fmtDateDM(p.fecha_retiro_ideal || p.fecha_retiro_taller_ideal || p.fecha_entrega_cliente);
  const dimT    = p.dim_t    || p.formato_t    || p.fam_a || p.tamano_cara_a || '';
  const pantoneT = p.pantone_t || p.colores_tiro || p.col_a || p.colores_a   || '';
  const dimR    = p.dim_r    || p.fam_b        || p.tamano_cara_b             || '';
  const pantoneR = p.pantone_r || p.colores_retiro || p.col_b || p.colores_b  || '';

  const lines = [];
  if (isExpress(p)) {
    lines.push('🚨 PRIORIDAD: EXPRESS');
    lines.push('Solicitamos priorizar este proyecto y confirmar programación a la brevedad.');
    lines.push('');
  }
  lines.push('Buen día,');
  lines.push('');
  lines.push(`Estimado equipo ${tallerNombre},`);
  lines.push('');
  lines.push('Compartimos orden para programación:');
  lines.push('');
  lines.push(`Proyecto: ${p.nombre_proyecto}`);
  if (p.sku) lines.push(`Modelo: ${p.sku}`);
  lines.push(`Cantidad: ${p.unidades || '-'} unidades`);
  if (fechaDM) lines.push(`Fecha objetivo retiro: ${fechaDM}`);
  lines.push('');
  lines.push('Especificaciones de impresión:');
  lines.push('');
  if (dimT || pantoneT) {
    lines.push(`Dimensiones del Diseño (T): ${dimT || '-'}`);
    if (pantoneT) lines.push(`Color / Código Pantone (Tiro): ${pantoneT}`);
    lines.push('');
  }
  if (dimR || pantoneR) {
    lines.push(`Dimensiones del Diseño (R): ${dimR || '-'}`);
    if (pantoneR) lines.push(`Color / Código Pantone (Retiro): ${pantoneR}`);
    lines.push('');
  }
  if (p.posicionamiento) {
    lines.push('Posicionamiento del Diseño:');
    lines.push(p.posicionamiento);
    lines.push('');
  }
  if (p.info_adicional) {
    lines.push('Información adicional:');
    lines.push(p.info_adicional);
    lines.push('');
  }
  lines.push(p.archivos
    ? `Archivos de producción:\n${p.archivos}`
    : 'Archivos de producción: se adjuntarán manualmente en el borrador.'
  );
  lines.push('');
  lines.push('Agradecemos confirmar factibilidad y fecha estimada de entrega.');
  lines.push('');
  lines.push('Saludos cordiales,');
  return lines.join('\n');
};

const buildInitialCompose = (p) => {
  const cfg = TALLER_EMAILS[(p.taller || '').toUpperCase().trim()] || { to: '', cc: [] };
  return {
    to:      cfg.to,
    cc:      [...CC_ALWAYS, ...cfg.cc].join(', '),
    subject: buildSubject(p),
    body:    buildBody(p, p.taller || 'Taller'),
  };
};

const getWarnings = (p) => {
  const w = [];
  if (!p.archivos)        w.push('Sin archivos');
  if (!p.posicionamiento) w.push('Sin posicionamiento');
  if (!TALLER_EMAILS[(p.taller || '').toUpperCase().trim()]) w.push(`Taller no mapeado: ${p.taller || '–'}`);
  return w;
};

// ── Componente ───────────────────────────────────────────────
const Correos = () => {
  const { data, updatePedidoStatus, SCRIPT_URL } = useData();

  const [expanded,    setExpanded]    = useState(null);
  const [compose,     setCompose]     = useState({});
  const [actionState, setActionState] = useState({});  // id → 'sending'|'draft_ok'|'sent_ok'|'error'
  const [draftUrls,   setDraftUrls]   = useState({});
  const [preview,     setPreview]     = useState({});
  const [attachments, setAttachments] = useState({});  // id → File[]
  const [dragging,    setDragging]    = useState(null); // id being dragged over

  // Dedup idéntico al de Labeling
  const getKey = (p) => `${String(p.pedido_id || p.id || '')}|${String(p.nombre_proyecto || '').trim()}`;

  const dedupedData = useMemo(() => {
    const seen = new Set();
    return data.filter(p => {
      const k = getKey(p);
      if (!k || k === '|' || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [data]);

  const pendingOrders = useMemo(
    () => dedupedData.filter(p => norm(p.estado_produccion) === 'pasar correo'),
    [dedupedData]
  );

  const toggleExpand = useCallback((p) => {
    const id = p.pedido_id;
    setExpanded(prev => (prev === id ? null : id));
    setCompose(prev => prev[id] ? prev : { ...prev, [id]: buildInitialCompose(p) });
  }, []);

  const updateField = (id, field, value) =>
    setCompose(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const addFiles = (id, fileList) => {
    const incoming = Array.from(fileList);
    setAttachments(prev => {
      const existing = prev[id] || [];
      // Evitar duplicados por nombre
      const names = new Set(existing.map(f => f.name));
      const merged = [...existing, ...incoming.filter(f => !names.has(f.name))];
      return { ...prev, [id]: merged };
    });
  };

  const removeFile = (id, index) =>
    setAttachments(prev => ({ ...prev, [id]: prev[id].filter((_, i) => i !== index) }));

  const totalSizeMB = (id) =>
    ((attachments[id] || []).reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1);

  // Convierte File[] a [{name, mimeType, data(base64)}] para el GAS
  const serializeFiles = async (files) =>
    Promise.all(files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const bytes  = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return { name: file.name, mimeType: file.type || 'application/octet-stream', data: btoa(binary) };
    }));

  const handleAction = async (p, type) => {
    const id = p.pedido_id;
    const c = compose[id];
    if (!c?.to || !c?.subject || !c?.body) return;

    setActionState(prev => ({ ...prev, [id]: 'sending' }));
    try {
      const serializedFiles = await serializeFiles(attachments[id] || []);

      const res  = await fetch(SCRIPT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action:      type === 'draft' ? 'emailDraft' : 'emailSend',
          pedidoId:    id,
          to:          c.to,
          cc:          c.cc,
          subject:     c.subject,
          emailBody:   c.body,
          attachments: serializedFiles,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error GAS');

      setActionState(prev => ({ ...prev, [id]: type === 'draft' ? 'draft_ok' : 'sent_ok' }));
      if (json.draftUrl) setDraftUrls(prev => ({ ...prev, [id]: json.draftUrl }));
      await updatePedidoStatus(id, 'correo enviado');
      setExpanded(null);
    } catch (e) {
      console.error('[Correos]', e.message);
      setActionState(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  if (pendingOrders.length === 0) {
    return (
      <div className="space-y-6">
        <Header count={0} />
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <CheckCircle2 size={40} className="mx-auto mb-2 opacity-20" />
          <p>No hay pedidos en estado "Pasar correo".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header count={pendingOrders.length} />

      <div className="space-y-3">
        {pendingOrders.map(p => {
          const id       = p.pedido_id;
          const isOpen   = expanded === id;
          const c        = compose[id] || {};
          const st       = actionState[id];
          const warnings = getWarnings(p);
          const draftUrl = draftUrls[id];
          const express  = isExpress(p);

          return (
            <div
              key={getKey(p)}
              className={`bg-white rounded-xl border shadow-sm transition-all ${
                isOpen ? 'border-blue-200 shadow-blue-50' : 'border-slate-200'
              }`}
            >
              {/* ── Fila de resumen ── */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
                onClick={() => toggleExpand(p)}
              >
                {express && (
                  <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                    EXPRESS
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">#{id}</span>
                    <span className="text-slate-600 text-sm truncate">{p.nombre_proyecto}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                    <span>{p.taller || '–'}</span>
                    {p.sku      && <span>· {p.sku}</span>}
                    {p.unidades && <span>· {p.unidades} u</span>}
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {warnings.map(w => (
                      <span key={w} className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle size={10} /> {w}
                      </span>
                    ))}
                  </div>
                )}

                {st === 'draft_ok' && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                    <CheckCircle2 size={14} /> Borrador creado
                  </span>
                )}
                {st === 'sent_ok' && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                    <CheckCircle2 size={14} /> Enviado
                  </span>
                )}
                {st === 'error' && (
                  <span className="text-xs font-bold text-red-500 shrink-0">Error — reintentar</span>
                )}

                {draftUrl && (
                  <a
                    href={draftUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 shrink-0"
                    onClick={e => e.stopPropagation()}
                    title="Abrir borrador en Gmail"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}

                {isOpen
                  ? <ChevronUp   size={18} className="text-slate-400 shrink-0" />
                  : <ChevronDown size={18} className="text-slate-400 shrink-0" />
                }
              </div>

              {/* ── Compositor ── */}
              {isOpen && (
                <div className="border-t border-slate-100 px-5 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Para" value={c.to || ''} onChange={v => updateField(id, 'to', v)} />
                    <Field label="CC"   value={c.cc || ''} onChange={v => updateField(id, 'cc', v)} />
                  </div>

                  <Field label="Asunto" value={c.subject || ''} onChange={v => updateField(id, 'subject', v)} />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cuerpo</label>
                      <button
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        onClick={() => setPreview(prev => ({ ...prev, [id]: !prev[id] }))}
                      >
                        {preview[id] ? <><EyeOff size={12} /> Editar</> : <><Eye size={12} /> Vista previa</>}
                      </button>
                    </div>
                    {preview[id] ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-72 overflow-y-auto">
                        {c.body}
                      </div>
                    ) : (
                      <textarea
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        rows={10}
                        value={c.body || ''}
                        onChange={e => updateField(id, 'body', e.target.value)}
                      />
                    )}
                  </div>

                  {/* ── Adjuntos ── */}
                  <FileDropZone
                    id={id}
                    files={attachments[id] || []}
                    dragging={dragging === id}
                    onDragOver={(e) => { e.preventDefault(); setDragging(id); }}
                    onDragLeave={() => setDragging(null)}
                    onDrop={(e) => { e.preventDefault(); setDragging(null); addFiles(id, e.dataTransfer.files); }}
                    onFileChange={(e) => addFiles(id, e.target.files)}
                    onRemove={(i) => removeFile(id, i)}
                    totalSizeMB={totalSizeMB(id)}
                  />

                  {warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                      <strong>Datos faltantes:</strong> {warnings.join(' · ')}.
                      Puedes editar el cuerpo antes de enviar.
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      disabled={st === 'sending' || !c.to}
                      onClick={() => handleAction(p, 'draft')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-blue-600 text-blue-600 font-bold text-sm hover:bg-blue-50 disabled:opacity-40 active:scale-95 transition-all"
                    >
                      {st === 'sending' ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
                      Crear borrador en Gmail
                    </button>
                    <button
                      disabled={st === 'sending' || !c.to}
                      onClick={() => handleAction(p, 'send')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all shadow-lg shadow-blue-900/20"
                    >
                      {st === 'sending' ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      Enviar directo
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FileDropZone = ({ id, files, dragging, onDragOver, onDragLeave, onDrop, onFileChange, onRemove, totalSizeMB }) => {
  const inputRef = useRef(null);
  const overLimit = parseFloat(totalSizeMB) > 5;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Paperclip size={12} /> Adjuntos
          {files.length > 0 && (
            <span className={`ml-1 font-normal ${overLimit ? 'text-red-500' : 'text-slate-400'}`}>
              ({files.length} archivo{files.length !== 1 ? 's' : ''} · {totalSizeMB} MB
              {overLimit ? ' — puede fallar si supera 5 MB' : ''})
            </span>
          )}
        </label>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors text-center text-xs
          ${dragging
            ? 'border-blue-400 bg-blue-50 text-blue-600'
            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-400'
          }`}
      >
        <Upload size={16} className="mx-auto mb-1 opacity-60" />
        Arrastra archivos aquí o <span className="font-bold underline">selecciona</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Lista de archivos adjuntos */}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={f.name + i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <FileText size={13} className="text-slate-400 shrink-0" />
              <span className="flex-1 truncate text-slate-700 font-medium">{f.name}</span>
              <span className="text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Header = ({ count }) => (
  <div>
    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
      <Mail className="text-blue-500" /> Correos a Talleres
    </h1>
    <p className="text-slate-500 text-sm mt-1">
      {count > 0
        ? `${count} pedido${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''} de enviar al taller.`
        : 'Envío de órdenes de producción a talleres.'}
    </p>
  </div>
);

const Field = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
    <input
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

export default Correos;
