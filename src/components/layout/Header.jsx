import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, Menu, RefreshCw, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import ProjectDetailsModal from '../ProjectDetailsModal';

const Header = ({ toggleSidebar }) => {
  const { isLoading, lastSync, fetchData, data, error } = useData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Buscar al escribir
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const found = (data || [])
      .filter(
        (p) =>
          String(p.pedido_id || '').toLowerCase().includes(q) ||
          String(p.nombre_proyecto || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
    setResults(found);
    setShowResults(found.length > 0);
  }, [query, data]);

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (pedido) => {
    setSelectedPedido(pedido);
    setShowResults(false);
    setQuery('');
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const syncLabel = isLoading
    ? 'Sincronizando...'
    : lastSync
    ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Sin sync';

  return (
    <>
      <header className="h-16 bg-white border-b border-dash-border flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-30">
        <div className="flex items-center flex-1">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-700"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Buscador */}
          <div className="max-w-md w-full relative hidden sm:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              className="block w-full pl-10 pr-8 py-2 border border-slate-200 rounded-md leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-accent focus:border-accent sm:text-sm transition-colors"
              placeholder="Buscar por ID o nombre de proyecto..."
            />
            {query && (
              <button
                onClick={handleClear}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Panel de resultados */}
            {showResults && (
              <div
                ref={panelRef}
                className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                {results.map((p) => (
                  <button
                    key={p.pedido_id}
                    onClick={() => handleSelect(p)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                  >
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      #{p.pedido_id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.nombre_proyecto}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.taller} · {p.estado_produccion}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Botón de sync simplificado */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            title={error ? `Error: ${error}` : `Última sync: ${syncLabel}`}
            className="flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin text-indigo-500" />
                <span>Sincronizando...</span>
              </>
            ) : error ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                <span className="text-red-500">Error</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                <span>{syncLabel}</span>
              </>
            )}
          </button>

          <button className="p-1.5 text-slate-400 hover:text-slate-600 relative rounded-full hover:bg-slate-100 transition-colors">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Modal de detalle al seleccionar un resultado */}
      {selectedPedido && (
        <ProjectDetailsModal
          pedido={selectedPedido}
          onClose={() => setSelectedPedido(null)}
        />
      )}
    </>
  );
};

export default Header;
