import React, { useState, useEffect, useRef } from 'react';
import { useData, cleanId } from '../context/DataContext';
import { jsPDF } from 'jspdf';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Download, X, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import CryptoJS from 'crypto-js';
import { SECURITY_CONFIG } from '../config/security';

const CLIENT_SALT = SECURITY_CONFIG.CLIENT_SALT;

const generateSignature = (id, bulto, total) =>
  CryptoJS.HmacSHA256(`${id}-${bulto}-${total}`, CLIENT_SALT)
    .toString(CryptoJS.enc.Hex)
    .substring(0, 10);

// ─── Preview visual de la etiqueta (CSS, sin jsPDF) ────────────────────────────

const LabelPreview = ({ pedido, editData, bultoNum, totalBultos }) => {
  const id = cleanId(pedido.pedido_id || pedido.id);
  const sig = generateSignature(id, bultoNum, totalBultos);
  const qrValue = `${window.location.origin}/update/${id}?b=${bultoNum}&t=${totalBultos}&sig=${sig}`;
  const nombre = (editData?.nombre || pedido.nombre_proyecto || 'SIN NOMBRE').toUpperCase();

  return (
    <div
      className="bg-white border-2 border-slate-300 rounded-lg shadow-md mx-auto overflow-hidden"
      style={{ width: 280, height: 280, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-slate-200">
        <span className="text-[9px] font-bold text-slate-500">ID PROYECTO: #{pedido.pedido_id || pedido.id}</span>
        <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">VERIFIED</span>
      </div>

      <div className="flex gap-2 px-3 pt-2">
        {/* Izquierda: info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-slate-900 leading-tight line-clamp-2 uppercase">{nombre}</p>
          <div className="mt-2 space-y-1">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">SKU / Modelo</p>
              <p className="text-[11px] font-bold text-slate-700">{editData?.sku || pedido.sku || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Cantidad</p>
              <p className="text-[16px] font-black text-slate-900">{(editData?.unidades || pedido.unidades || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase">Taller</p>
              <p className="text-[10px] font-bold text-slate-700">{editData?.taller || pedido.taller || 'N/A'}</p>
            </div>
            {editData?.tecnica && (
              <div>
                <p className="text-[8px] font-bold text-slate-400 uppercase">Técnica</p>
                <p className="text-[9px] font-bold text-slate-600 uppercase">{editData.tecnica}</p>
              </div>
            )}
          </div>
        </div>

        {/* Derecha: QR */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <QRCodeCanvas value={qrValue} size={90} level="H" />
          <p className="text-[8px] font-bold text-slate-500 text-center">
            {bultoNum} / {totalBultos}
          </p>
          <p className="text-[6px] text-slate-300">SIG: {sig}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 text-center pb-1">
        <p className="text-[7px] text-slate-400 font-medium">CONTROL TOWER • SCAN PARA ACTUALIZAR ESTADO</p>
      </div>
    </div>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────

const LabelGenerator = ({ pedidos, specificBulto = null, onClose, onComplete }) => {
  const { updatePedidoStatus, talleres } = useData();
  const [bultosMap, setBultosMap] = useState({});
  const [editMode, setEditMode] = useState({});
  const [generating, setGenerating] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const listaPedidos = Array.isArray(pedidos) ? pedidos : [pedidos];

  // Clave única por fila: ID + nombre — igual que en Labeling.jsx
  // Evita que LÁSER NOW 1 y LÁSER NOW 2 (mismo pedido_id) compartan estado de bultos
  const mapKey = (p) => `${String(p.pedido_id || p.id || '')}|${String(p.nombre_proyecto || '').trim()}`;

  // Opciones de taller desde el contexto (dinámico) + fallback
  const tallerOptions = talleres?.map((t) => t.nombre) || [
    'Yute Impresiones', 'Pintapack', 'Lidi', 'Romel', 'We Are SpA', 'Ideamania',
  ];

  useEffect(() => {
    const initialMap = {};
    const initialEdit = {};
    listaPedidos.forEach((p) => {
      const id = mapKey(p);
      initialMap[id] = p.bultos || 1;
      initialEdit[id] = {
        nombre:   p.nombre_proyecto || '',
        sku:      p.sku || '',
        unidades: p.unidades || 0,
        taller:   p.taller || tallerOptions[0] || '',
        tecnica:  '',
        detalles: '',
      };
    });
    setBultosMap(initialMap);
    setEditMode(initialEdit);
  }, []);

  const updateBultos = (id, delta) =>
    setBultosMap((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));

  const updateEdit = (id, field, value) =>
    setEditMode((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  // ── Pedido de preview actual ──
  const previewPedido = listaPedidos[previewIndex] || listaPedidos[0];
  const previewId = previewPedido ? mapKey(previewPedido) : null;
  const previewEdit = editMode[previewId] || {};
  const previewTotal = bultosMap[previewId] || 1;

  // ── Generar PDF ──
  const generatePDF = async () => {
    setGenerating(true);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [101.6, 101.6] });
    const w = 101.6;
    let pageCount = 0;

    for (const p of listaPedidos) {
      if (!p) continue;
      const rawId = p.pedido_id || p.id || 'S-N';
      const id = cleanId(rawId);
      const mk = mapKey(p);
      const ed = editMode[mk] || {};
      const totalBultos = bultosMap[mk] || 1;
      const bultosAImprimir = specificBulto
        ? [specificBulto]
        : Array.from({ length: totalBultos }, (_, i) => i + 1);

      for (const b of bultosAImprimir) {
        if (pageCount > 0) doc.addPage([101.6, 101.6], 'portrait');
        pageCount++;

        // Fondo
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, w, 101.6, 'F');

        // ID + sello
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`ID PROYECTO: #${rawId}`, 5, 8);

        doc.setDrawColor(210); doc.setFillColor(245, 247, 250);
        doc.roundedRect(w - 38, 3.5, 32, 6, 1, 1, 'FD');
        doc.setFontSize(5.5);
        doc.text('SECURITY VERIFIED', w - 22, 7.5, { align: 'center' });

        // Nombre proyecto
        doc.setFontSize(15);
        const nombre = (ed.nombre || p.nombre_proyecto || 'SIN NOMBRE').toUpperCase();
        const splitTitle = doc.splitTextToSize(nombre, 55);
        doc.text(splitTitle.slice(0, 2), 5, 17);

        // Línea divisoria
        doc.setLineWidth(0.4); doc.setDrawColor(180);
        doc.line(5, 26, w - 5, 26);

        // SKU
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text('SKU / MODELO:', 5, 32);
        doc.setFontSize(11); doc.setTextColor(0);
        doc.text(String(ed.sku || p.sku || 'N/A'), 5, 38);

        // Cantidad
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text('CANTIDAD TOTAL:', 5, 46);
        doc.setFontSize(18); doc.setTextColor(0);
        doc.text(String(ed.unidades || p.unidades || 0), 5, 56);

        // QR — tamaño aumentado para mejor calidad
        const canvas = document.getElementById(`qr-pdf-${mk}-${b}`);
        if (canvas) {
          const qrUrl = canvas.toDataURL('image/png');
          doc.addImage(qrUrl, 'PNG', w - 45, 28, 40, 40);
        }

        // Firma microscópica bajo el QR
        const sig = generateSignature(id, b, totalBultos);
        doc.setFontSize(4.5); doc.setTextColor(180);
        doc.text(`SIG: ${sig}`, w - 25, 69.5, { align: 'center' });
        doc.setTextColor(0);

        // Taller
        doc.setFontSize(7.5); doc.setTextColor(120);
        doc.text('TALLER:', 5, 64);
        doc.setFontSize(10); doc.setTextColor(0);
        doc.text((ed.taller || p.taller || 'N/A').toUpperCase(), 5, 70);

        // Técnica / detalles
        const tecnica  = ed.tecnica  || '';
        const detalles = ed.detalles || '';
        if (tecnica || detalles) {
          doc.setFontSize(7); doc.setTextColor(120);
          doc.text('DETALLES DE IMPRESIÓN:', 5, 78);
          doc.setTextColor(0);
          doc.setFontSize(8);
          if (tecnica)  doc.text(tecnica.toUpperCase(), 5, 83);
          if (detalles) {
            const splitDet = doc.splitTextToSize(detalles.toUpperCase(), 50);
            doc.text(splitDet.slice(0, 2), 5, 88);
          }
        }

        // Bultos (esquina inferior derecha)
        doc.setDrawColor(180);
        doc.line(w - 47, 70, w - 5, 70);
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text('BULTOS / CAJAS:', w - 44, 76);
        doc.setFontSize(18); doc.setTextColor(0);
        doc.text(`${b} / ${totalBultos}`, w - 44, 87);

        // Footer
        doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(120);
        doc.line(5, 93, w - 5, 93);
        doc.text('CONTROL TOWER • SCAN PARA ACTUALIZAR ESTADO', w / 2, 97, { align: 'center' });
        doc.setTextColor(0);
      }
    }

    const baseName =
      listaPedidos.length === 1
        ? `ETIQUETA_${listaPedidos[0].pedido_id || listaPedidos[0].id}`
        : `LOTE_${listaPedidos.length}_PEDIDOS`;

    try {
      doc.save(`${baseName}.pdf`);
    } catch {
      doc.save('etiquetas.pdf');
    }

    setGenerating(false);
    setPrinted(true);

    if (onComplete) {
      onComplete(
        listaPedidos.map((p) => ({
          id: p.pedido_id || p.id,
          bultos: bultosMap[mapKey(p)] || 1,
        }))
      );
    }
  };

  const totalEtiquetas = Object.values(bultosMap).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-700 bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Printer className="text-blue-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Impresión Zebra 4×4</h2>
              <p className="text-xs text-slate-400">{listaPedidos.length} proyecto{listaPedidos.length !== 1 ? 's' : ''} · {totalEtiquetas} etiquetas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((v) => !v)}
              title={showPreview ? 'Ocultar preview' : 'Ver preview de etiqueta'}
              className={`p-2 rounded-full transition-colors ${showPreview ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            >
              {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && previewPedido && (
          <div className="bg-slate-900/60 border-b border-slate-700 p-5 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preview Etiqueta</p>
              {listaPedidos.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                    className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-40"
                  >‹</button>
                  <span className="text-xs text-slate-400">{previewIndex + 1} / {listaPedidos.length}</span>
                  <button
                    onClick={() => setPreviewIndex((i) => Math.min(listaPedidos.length - 1, i + 1))}
                    disabled={previewIndex === listaPedidos.length - 1}
                    className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-40"
                  >›</button>
                </div>
              )}
            </div>
            <div className="relative">
              <LabelPreview
                pedido={previewPedido}
                editData={previewEdit}
                bultoNum={1}
                totalBultos={previewTotal}
              />
            </div>
          </div>
        )}

        {/* Lista de pedidos */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {listaPedidos.map((p) => {
            const mk = mapKey(p);
            const displayId = p.pedido_id || p.id;
            const count = bultosMap[mk] || 1;
            const ed = editMode[mk] || {};

            return (
              <div key={mk} className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                {/* Fila superior: ID + nombre + selector de bultos */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-blue-400 mb-0.5">#{displayId}</p>
                    {p.isManual ? (
                      <input
                        type="text"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm font-bold text-white outline-none focus:border-blue-500"
                        value={ed.nombre || ''}
                        onChange={(e) => updateEdit(mk, 'nombre', e.target.value)}
                        placeholder="Nombre del Proyecto"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-100 truncate">{p.nombre_proyecto || p.proyecto}</p>
                    )}
                  </div>
                  {/* Selector bultos */}
                  <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1 border border-slate-700">
                    <button onClick={() => updateBultos(mk, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-400 font-bold">-</button>
                    <span className="w-5 text-center font-mono font-bold text-blue-400 text-sm">{count}</span>
                    <button onClick={() => updateBultos(mk, 1)}  className="w-7 h-7 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-400 font-bold">+</button>
                  </div>
                </div>

                {/* Campos editables */}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="SKU / Modelo"    value={ed.sku}      onChange={(v) => updateEdit(mk, 'sku', v)}      type="text" />
                  <Field label="Cantidad Total"   value={ed.unidades} onChange={(v) => updateEdit(mk, 'unidades', Number(v) || 0)} type="number" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Taller dinámico */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Taller</label>
                    <select
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                      value={ed.taller || ''}
                      onChange={(e) => updateEdit(mk, 'taller', e.target.value)}
                    >
                      {tallerOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <Field label="Técnica / Color" value={ed.tecnica}  onChange={(v) => updateEdit(mk, 'tecnica', v)}  type="text" placeholder="Ej: 1 Color Blanco" />
                </div>
                <Field label="Ubicación / Detalles" value={ed.detalles} onChange={(v) => updateEdit(mk, 'detalles', v)} type="text" placeholder="Ej: Centrado, 5.4cm del borde" />
              </div>
            );
          })}
        </div>

        {/* Footer: botón de descarga */}
        <div className="p-5 border-t border-slate-700 shrink-0 space-y-3">
          <button
            onClick={generatePDF}
            disabled={generating}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              generating
                ? 'bg-slate-700 text-slate-500'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-xl shadow-blue-900/40 active:scale-[0.98]'
            }`}
          >
            {generating ? <Loader2 className="animate-spin text-blue-400" size={20} /> : <Download size={20} />}
            {generating ? 'Generando PDF...' : `Descargar ${totalEtiquetas} Etiqueta${totalEtiquetas !== 1 ? 's' : ''} (4×4)`}
          </button>

          {printed && (
            <div className="flex items-center gap-2 text-emerald-400 justify-center text-sm font-bold">
              <CheckCircle size={16} /> ¡PDF generado con éxito!
            </div>
          )}

          <p className="text-[10px] text-slate-500 text-center">
            Configura tu Zebra en tamaño <strong className="text-slate-400">4.00 × 4.00 pulg</strong> antes de imprimir.
          </p>
        </div>
      </div>

      {/* Canvas ocultos para PDF (alta resolución: 280px) */}
      <div className="hidden">
        {listaPedidos.map((p) => {
          const rawId = p.pedido_id || p.id;
          const id = cleanId(rawId);
          const mk = mapKey(p);
          const total = bultosMap[mk] || 1;
          return Array.from({ length: total }).map((_, i) => {
            const b = i + 1;
            const sig = generateSignature(id, b, total);
            const qrValue = `${window.location.origin}/update/${id}?b=${b}&t=${total}&sig=${sig}`;
            return (
              <QRCodeCanvas
                key={`${mk}-${b}`}
                id={`qr-pdf-${mk}-${b}`}
                value={qrValue}
                size={280}
                level="H"
                includeMargin={true}
              />
            );
          });
        })}
      </div>
    </div>
  );
};

// Sub-componente campo de texto
const Field = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
    <input
      type={type}
      className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

export default LabelGenerator;
