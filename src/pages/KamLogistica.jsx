import React, { useMemo, useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Search, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, Pencil } from 'lucide-react';

// ── Normalización ─────────────────────────────────────────────
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// ── Colores por estado logístico ──────────────────────────────
const ESTADO_STYLES = {
  'entregado':                 'bg-green-100 text-green-800 border-green-200',
  'listo para despacho':       'bg-sky-100 text-sky-800 border-sky-200',
  'envio creado':              'bg-violet-100 text-violet-800 border-violet-200',
  'envio pm oficina':          'bg-violet-100 text-violet-800 border-violet-200',
  'envio am oficina':          'bg-violet-100 text-violet-800 border-violet-200',
  'listo retiro en oficina':   'bg-orange-100 text-orange-800 border-orange-200',
  'en preparacion':            'bg-yellow-100 text-yellow-800 border-yellow-200',
  'en proceso':                'bg-blue-100 text-blue-800 border-blue-200',
  'listo en taller':           'bg-teal-100 text-teal-800 border-teal-200',
  'listo en taller - falta facturacion': 'bg-red-100 text-red-800 border-red-200',
  'reprogramado/devuelto':     'bg-red-100 text-red-800 border-red-200',
  'incidencia en despacho':    'bg-red-100 text-red-800 border-red-200',
  'pendiente de armado':       'bg-gray-100 text-gray-700 border-gray-200',
};

const estadoStyle = (s) =>
  ESTADO_STYLES[norm(s)] || 'bg-gray-100 text-gray-600 border-gray-200';

// ── Formato fecha DD/MM ───────────────────────────────────────
const fmtDate = (v) => {
  if (!v) return '–';
  const d = new Date(String(v).includes('T') ? v : v + 'T00:00:00');
  if (isNaN(d.getTime())) return v;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ── Columnas tabla ────────────────────────────────────────────
const COLS = [
  { key: 'canal',              label: 'Método',          w: 'w-20'  },
  { key: 'pedido_id',          label: 'N° Pedido',       w: 'w-24'  },
  { key: 'nombre_proyecto',    label: 'Proyecto',        w: 'w-56'  },
  { key: 'fecha_retiro_ideal',    label: 'Retiro Taller',       w: 'w-28'  },
  { key: 'fecha_entrega_cliente', label: 'Despacho Cliente',    w: 'w-28'  },
  { key: 'fecha_entrega',         label: 'Despacho Real',       w: 'w-28'  },
  { key: 'estado_produccion',  label: 'Estado Taller',   w: 'w-28'  },
  { key: 'estado_logistico',   label: 'Estado Logístico',w: 'w-44'  },
  { key: 'taller',             label: 'Taller',          w: 'w-36'  },
  { key: 'metodo_entrega',     label: 'Entrega',         w: 'w-36'  },
  { key: 'vendedor',           label: 'Vendedor',        w: 'w-32'  },
  { key: 'documento',          label: 'Documento',       w: 'w-28'  },
  { key: 'comentario_kam',     label: 'Comentario KAM',  w: 'w-52'  },
];

const KamLogistica = () => {
  const { data, userRole, updateLogisticaCell } = useData();

  const [search,    setSearch]    = useState('');
  const [filterVendedor, setFilterVendedor] = useState('todos');
  const [filterEstado,   setFilterEstado]   = useState('activos');
  const [sortCol, setSortCol]   = useState('fecha_retiro_ideal');
  const [sortDir, setSortDir]   = useState('asc');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue,  setEditValue]  = useState('');
  const inputRef = useRef(null);

  // Dedup por pedido_id + nombre_proyecto
  const dedupedData = useMemo(() => {
    const seen = new Set();
    return data.filter(p => {
      const k = `${p.pedido_id}|${String(p.nombre_proyecto || '').trim()}`;
      if (!k || k === '|' || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [data]);

  // Lista de vendedores únicos
  const vendedores = useMemo(() => {
    const set = new Set(dedupedData.map(p => p.vendedor).filter(Boolean));
    return ['todos', ...Array.from(set).sort()];
  }, [dedupedData]);

  // Filtrado
  const filtered = useMemo(() => {
    return dedupedData.filter(p => {
      // Filtro vendedor
      if (filterVendedor !== 'todos' && norm(p.vendedor) !== norm(filterVendedor)) return false;

      // Filtro estado
      const el = norm(p.estado_logistico);
      if (filterEstado === 'activos') {
        if (el === 'entregado' || el === 'anulado') return false;
      } else if (filterEstado === 'entregados') {
        if (el !== 'entregado') return false;
      }
      // 'todos' no filtra

      // Búsqueda texto
      if (search) {
        const q = norm(search);
        return (
          norm(p.pedido_id).includes(q) ||
          norm(p.nombre_proyecto).includes(q) ||
          norm(p.vendedor).includes(q) ||
          norm(p.taller).includes(q)
        );
      }
      return true;
    });
  }, [dedupedData, filterVendedor, filterEstado, search]);

  // Ordenamiento
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = String(a[sortCol] || '');
      const vb = String(b[sortCol] || '');
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filtered, sortCol, sortDir]);

  const handleSort = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  };

  const startEditComment = (p) => {
    const key = `${p.pedido_id}|${p.nombre_proyecto}`;
    setEditingKey(key);
    setEditValue(p.comentario_kam || '');
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const saveComment = async (p) => {
    const val = editValue.trim();
    setEditingKey(null);
    await updateLogisticaCell(p.pedido_id, { M: val }, { comentario_kam: val });
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronsUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-500" />
      : <ChevronDown size={12} className="text-blue-500" />;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Logística & Seguimiento</h1>
        <p className="text-slate-500 text-sm mt-1">
          Seguimiento de estados logísticos y despachos · {sorted.length} pedidos
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Buscador */}
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Buscar pedido, proyecto, taller..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtro estado */}
        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
        >
          <option value="activos">En curso (sin entregados)</option>
          <option value="todos">Todos</option>
          <option value="entregados">Solo entregados</option>
        </select>

        {/* Filtro vendedor */}
        <select
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={filterVendedor}
          onChange={e => setFilterVendedor(e.target.value)}
        >
          {vendedores.map(v => (
            <option key={v} value={v}>{v === 'todos' ? 'Todos los KAM' : v}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 whitespace-nowrap ${col.w}`}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="text-center py-12 text-slate-400">
                  No hay pedidos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              sorted.map((p, i) => (
                <tr
                  key={`${p.pedido_id}|${p.nombre_proyecto}|${i}`}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  {/* Método/Canal */}
                  <td className="px-3 py-2.5">
                    {p.canal ? (
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {p.canal}
                      </span>
                    ) : '–'}
                  </td>

                  {/* N° Pedido */}
                  <td className="px-3 py-2.5 font-bold text-slate-700">
                    #{p.pedido_id}
                  </td>

                  {/* Proyecto */}
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <span className="font-medium text-slate-800 truncate block" title={p.nombre_proyecto}>
                      {p.nombre_proyecto || '–'}
                    </span>
                    {p.sku && <span className="text-xs text-slate-400">{p.sku}</span>}
                  </td>

                  {/* Retiro taller ideal */}
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {fmtDate(p.fecha_retiro_ideal)}
                  </td>

                  {/* Despacho Cliente (propuesto) */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.fecha_entrega_cliente
                      ? <span className="text-indigo-700 font-semibold text-xs">{fmtDate(p.fecha_entrega_cliente)}</span>
                      : <span className="text-slate-300 text-xs">–</span>}
                  </td>

                  {/* Despacho real */}
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {fmtDate(p.fecha_entrega)}
                  </td>

                  {/* Estado Taller */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                      {p.estado_produccion || '–'}
                    </span>
                  </td>

                  {/* Estado Logístico */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.estado_logistico ? (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${estadoStyle(p.estado_logistico)}`}>
                        {p.estado_logistico}
                      </span>
                    ) : '–'}
                  </td>

                  {/* Taller */}
                  <td className="px-3 py-2.5 text-slate-600 truncate max-w-[144px]" title={p.taller}>
                    {p.taller || '–'}
                  </td>

                  {/* Método entrega */}
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {p.metodo_entrega || '–'}
                  </td>

                  {/* Vendedor */}
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                    {p.vendedor || '–'}
                  </td>

                  {/* Documento */}
                  <td className="px-3 py-2.5">
                    {p.documento ? (
                      /^https?:/.test(p.documento) ? (
                        <a
                          href={p.documento}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs font-medium"
                        >
                          Ver <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">{p.documento}</span>
                      )
                    ) : '–'}
                  </td>

                  {/* Comentario KAM — editable inline */}
                  <td className="px-3 py-2.5 max-w-[208px]">
                    {editingKey === `${p.pedido_id}|${p.nombre_proyecto}` ? (
                      <input
                        ref={inputRef}
                        className="w-full text-xs border border-blue-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveComment(p)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveComment(p);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                      />
                    ) : (
                      <button
                        className="group flex items-center gap-1 text-left w-full"
                        title="Clic para editar comentario"
                        onClick={() => startEditComment(p)}
                      >
                        <span className="text-xs text-slate-600 truncate block max-w-[180px]">
                          {p.comentario_kam || <span className="text-slate-300 italic">Agregar comentario…</span>}
                        </span>
                        <Pencil size={10} className="shrink-0 text-slate-300 group-hover:text-blue-400 transition-colors" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Leyenda estados */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries({
          'Entregado':           'bg-green-100 text-green-800 border-green-200',
          'Listo para despacho': 'bg-sky-100 text-sky-800 border-sky-200',
          'Envío Creado':        'bg-violet-100 text-violet-800 border-violet-200',
          'Listo retiro Oficina':'bg-orange-100 text-orange-800 border-orange-200',
          'En preparación':      'bg-yellow-100 text-yellow-800 border-yellow-200',
          'En proceso':          'bg-blue-100 text-blue-800 border-blue-200',
          'Incidencia':          'bg-red-100 text-red-800 border-red-200',
        }).map(([label, cls]) => (
          <span key={label} className={`px-2 py-0.5 rounded-full border font-bold ${cls}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default KamLogistica;
