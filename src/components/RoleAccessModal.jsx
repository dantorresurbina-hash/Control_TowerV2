import React, { useState } from 'react';
import { Lock, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import CryptoJS from 'crypto-js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 1 minuto

const RoleAccessModal = ({ isOpen, onClose }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const { updateRole } = useData();

  // Hash del PIN configurado via variable de entorno.
  // Si no está configurado, se usa el hash de "1234" como fallback de desarrollo.
  // Para generar: CryptoJS.SHA256("tu_pin").toString()
  const CORRECT_HASH =
    import.meta.env.VITE_ADMIN_PIN_HASH ||
    '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; // hash de "1234"

  const isLocked = lockedUntil && Date.now() < lockedUntil;
  const secondsLeft = isLocked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLocked) return;

    const inputHash = CryptoJS.SHA256(pin).toString();

    if (inputHash === CORRECT_HASH) {
      updateRole('admin');
      setPin('');
      setError(false);
      setAttempts(0);
      setLockedUntil(null);
      onClose();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 2000);

      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setAttempts(0);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center text-slate-800 font-bold">
            <Lock className="w-5 h-5 mr-2 text-indigo-600" />
            Acceso Administrador
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isLocked ? (
            <div className="text-center py-4">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-red-600">Demasiados intentos fallidos</p>
              <p className="text-xs text-slate-500 mt-1">Espera {secondsLeft}s para intentar de nuevo</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 text-center">
                Ingresa tu PIN para desbloquear los módulos operativos.
              </p>

              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  maxLength={8}
                  className={`w-full text-center text-2xl tracking-[1em] py-3 border rounded-xl outline-none transition-all ${
                    error
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                  }`}
                  autoFocus
                />
                {error && (
                  <div className="absolute -bottom-6 left-0 right-0 text-center text-[10px] font-bold text-red-500 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    PIN INCORRECTO — {MAX_ATTEMPTS - attempts} intentos restantes
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center space-x-2 mt-2"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Validar Acceso</span>
              </button>
            </>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors"
            >
              Cancelar y volver como KAM
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleAccessModal;
