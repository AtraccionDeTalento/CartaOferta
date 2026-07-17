import React, { useState } from 'react';
import { MOCK_PROFILES, UserProfile, verifyRolePassword, loginAsMockUser } from '../../services/auth';
import { Lock, ShieldCheck } from 'lucide-react';

export const LoginModule: React.FC = () => {
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSelect = (profile: UserProfile) => {
    setSelected(profile);
    setPassword('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (verifyRolePassword(selected, password)) {
      loginAsMockUser(selected);
    } else {
      setError('Contraseña incorrecta. Intente nuevamente.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-usil-blue-900 bg-gradient-to-br from-usil-blue-900 to-usil-blue-950 p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex bg-white rounded-2xl px-5 py-3 shadow-lg mb-4">
            <img src={`${import.meta.env.BASE_URL}logo-usil.png`} alt="USIL" className="h-10 w-auto" />
          </div>
          <h1 className="text-white font-extrabold text-xl tracking-wide">HR OPERATIONS MANAGEMENT SYSTEM</h1>
          <p className="text-usil-blue-200 text-sm mt-1">Seleccione su rol para ingresar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {MOCK_PROFILES.map((profile) => {
              const isSelected = selected?.uid === profile.uid;
              return (
                <button
                  key={profile.uid}
                  type="button"
                  onClick={() => handleSelect(profile)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all duration-150
                    ${isSelected
                      ? 'border-usil-blue-600 bg-usil-blue-50 ring-2 ring-usil-blue-200'
                      : 'border-slate-200 hover:border-usil-blue-300 hover:bg-slate-50'
                    }`}
                >
                  <span className="text-2xl">{profile.avatar}</span>
                  <span className="text-xs font-bold text-slate-800 leading-tight">{profile.displayName}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{profile.role}</span>
                </button>
              );
            })}
          </div>

          {selected && (
            <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 pt-5">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wide">
                <Lock className="w-3.5 h-3.5" />
                Contraseña de {selected.displayName}
              </label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingrese su contraseña"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-usil-blue-300"
              />
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-usil-blue-700 hover:bg-usil-blue-800 text-white font-bold text-sm py-2.5 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Ingresar como {selected.role}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
