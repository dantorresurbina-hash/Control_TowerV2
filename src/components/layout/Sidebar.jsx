import { useData } from '../../context/DataContext';
import {
  LayoutDashboard, Truck, Activity, TriangleAlert, MessagesSquare,
  Settings, Menu, FileText, Monitor, Lock, Unlock, UserCircle,
  Tag, Cloud, CloudOff, RefreshCw, Factory, ClipboardCheck, Mail, PackageCheck, Warehouse,
} from 'lucide-react';
import { SECURITY_CONFIG } from '../../config/security';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, openSettings }) => {
  const { userRole, updateRole, isLocalStorage, lastSync, fetchData, isLoading, error } = useData();

  const navItems = [
    { id: 'tower',    label: 'Control Tower',     icon: LayoutDashboard, roles: ['kam', 'admin'] },
    { id: 'capacity', label: 'Capacidad Talleres', icon: Activity,        roles: ['admin'] },
    { id: 'logistics',label: 'Logística & Retiros',icon: Truck,           roles: ['admin'] },
    { id: 'labeling',     label: 'Etiquetado QR',      icon: Tag,          roles: ['kam', 'admin'] },
    { id: 'kamlogistica', label: 'Mis Despachos',      icon: PackageCheck, roles: ['kam', 'admin'] },
    { id: 'correos',      label: 'Correos Talleres',   icon: Mail,         roles: ['admin'] },
    { id: 'bodega',       label: 'Modo Bodega',        icon: Warehouse,    roles: ['admin'] },
    { id: 'dispatch',     label: 'Guías de Despacho',  icon: FileText,     roles: ['kam', 'admin'] },
    { id: 'conflicts',label: 'Conflictos',          icon: TriangleAlert,   roles: ['admin'] },
    { id: 'simulator',label: 'Simulador',           icon: Settings,        roles: ['admin'] },
    { id: 'workshop', label: 'Modo Taller',         icon: Factory,         roles: ['admin'] },
    { id: 'yute',     label: 'Yute Impresiones',    icon: ClipboardCheck,  roles: ['admin'] },
    { id: 'ai',       label: 'Consultas IA',        icon: MessagesSquare,  roles: ['kam', 'admin'] },
    { id: 'historical',label: 'Análisis Histórico', icon: FileText,        roles: ['admin'] },
    { id: 'tv',       label: 'Modo Planta',         icon: Monitor,         roles: ['admin'] },
  ];

  const filteredItems = navItems.filter((item) => item.roles.includes(userRole));

  // Estado de sincronización simplificado
  const isStale = lastSync && Date.now() - lastSync.getTime() > SECURITY_CONFIG.STALE_DATA_THRESHOLD;
  const isSynced = !isLocalStorage && !isStale && !error;

  const syncColor = isLoading ? 'text-indigo-400' : isSynced ? 'text-green-400' : 'text-orange-400';
  const SyncIcon = isLocalStorage ? CloudOff : Cloud;
  const syncLabel = isLoading
    ? 'Sincronizando...'
    : isSynced
    ? `Al día · ${lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
    : isStale
    ? 'Datos desactualizados'
    : 'Sin conexión';

  return (
    <aside
      className={`bg-[#1e1b4b] text-indigo-200 w-64 flex-shrink-0 flex flex-col transition-all duration-300 fixed inset-y-0 left-0 z-[70] md:relative md:inset-0 md:z-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-indigo-900/60 shrink-0">
        <div className="w-8 h-8 rounded bg-accent grid place-items-center text-white font-bold mr-3">
          <span>CT</span>
        </div>
        <span className="text-white font-heading font-semibold text-lg tracking-wide" translate="no">
          Control<span className="text-accent">Tower</span>
        </span>
      </div>

      {/* Navegación */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
          <span>Módulos</span>
          {userRole === 'admin' ? (
            <button onClick={() => updateRole('kam')} className="text-green-500 hover:text-green-400 group relative" title="Salir de Admin">
              <Unlock className="w-3 h-3" />
            </button>
          ) : (
            <button onClick={openSettings} className="text-slate-600 hover:text-slate-400" title="Acceso Admin">
              <Lock className="w-3 h-3" />
            </button>
          )}
        </div>

        <nav className="space-y-1 px-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (window.innerWidth < 768) setIsOpen(false);
                }}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-indigo-500/20 text-white'
                    : 'text-indigo-300 hover:bg-indigo-500/10 hover:text-white'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-indigo-300' : 'text-indigo-400/60'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: sync + perfil */}
      <div className="p-4 border-t border-indigo-900/60 space-y-3">
        {/* Indicador de sync simplificado */}
        <div className="flex items-center justify-between bg-indigo-950/50 rounded-lg px-3 py-2 border border-indigo-800/40">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            ) : (
              <SyncIcon className={`w-3.5 h-3.5 ${syncColor}`} />
            )}
            <span className={`text-[11px] font-medium ${syncColor}`} translate="no">
              {syncLabel}
            </span>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            title="Sincronizar ahora"
            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-500 hover:text-white"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Perfil */}
        <div className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full grid place-items-center text-xs font-medium text-white ${
              userRole === 'admin' ? 'bg-indigo-500' : 'bg-indigo-900'
            }`}
          >
            <UserCircle className="w-5 h-5" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-indigo-100 capitalize">
              {userRole === 'admin' ? 'Administrador' : 'KAM / Vendedor'}
            </p>
            <p className="text-xs text-indigo-400">
              {userRole === 'admin' ? 'Gestión Total' : 'Solo Consultas'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
