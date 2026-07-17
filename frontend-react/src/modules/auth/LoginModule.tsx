import React, { useState } from 'react';
import {
  UserProfile,
  UserRole,
  verifyRolePassword,
  loginAsMockUser,
  getAllProfiles,
  registerNewUser,
  TEMP_DEMO_PASSWORD,
} from '../../services/auth';
import { Lock, ShieldCheck, UserPlus, ArrowLeft } from 'lucide-react';

const ROLES: UserRole[] = ['Business Partner', 'Compensaciones', 'Nómina', 'Admin'];

export const LoginModule: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [profiles, setProfiles] = useState<UserProfile[]>(() => getAllProfiles());
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Business Partner');
  const [regError, setRegError] = useState('');

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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) {
      setRegError('Completa nombre y correo para continuar.');
      return;
    }
    const newProfile = registerNewUser({ displayName: regName, email: regEmail, role: regRole });
    setProfiles(getAllProfiles());
    setRegName('');
    setRegEmail('');
    setRegError('');
    setMode('login');
    handleSelect(newProfile);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-usil-blue-900 bg-gradient-to-br from-usil-blue-900 to-usil-blue-950 p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex bg-white rounded-2xl px-5 py-3 shadow-lg mb-4">
            <img src={`${import.meta.env.BASE_URL}logo-usil.png`} alt="USIL" className="h-10 w-auto" />
          </div>
          <h1 className="text-white font-extrabold text-xl tracking-wide">HR OPERATIONS MANAGEMENT SYSTEM</h1>
          <p className="text-usil-blue-200 text-sm mt-1">
            {mode === 'login' ? 'Seleccione su rol para ingresar' : 'Crear una nueva cuenta'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
          {mode === 'login' ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {profiles.map((profile) => {
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

              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSelected(null); }}
                className="mt-5 w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 text-slate-600 hover:border-usil-blue-300 hover:text-usil-blue-700 font-bold text-sm py-2.5 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Registrar nuevo usuario
              </button>
            </>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <button
                type="button"
                onClick={() => { setMode('login'); setRegError(''); }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-usil-blue-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al login
              </button>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ej: María Fernández"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-usil-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Correo</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nombre@usil.edu.pe"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-usil-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRegRole(role)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-colors
                        ${regRole === role
                          ? 'border-usil-blue-600 bg-usil-blue-50 text-usil-blue-700 ring-2 ring-usil-blue-200'
                          : 'border-slate-200 text-slate-600 hover:border-usil-blue-300'
                        }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Cuenta temporal de demostración: la contraseña asignada será <strong className="text-slate-600">{TEMP_DEMO_PASSWORD}</strong> para todos los usuarios mientras dure la prueba.
              </p>

              {regError && <p className="text-xs font-semibold text-red-600">{regError}</p>}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-usil-blue-700 hover:bg-usil-blue-800 text-white font-bold text-sm py-2.5 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Crear cuenta
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
