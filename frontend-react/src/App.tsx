import React, { useState, useEffect } from 'react';
import { getCurrentUser, UserProfile, subscribeToAuth } from './services/auth';
import { isFirebaseConfigured } from './services/firebase';
import { DashboardModule } from './modules/dashboard/DashboardModule';
import { IngresosModule } from './modules/ingresos/IngresosModule';
import { MovimientosModule } from './modules/movimientos/MovimientosModule';
import { CartasModule } from './modules/cartas/CartasModule';
import { CatalogosModule } from './modules/catalogos/CatalogosModule';
import { OrganigramaModule } from './modules/organigrama/OrganigramaModule';
import { 
  LayoutDashboard, 
  UserPlus, 
  TrendingUp, 
  FileBadge2,
  FolderTree, 
  BookOpen, 
  LogOut, 
  User, 
  Cloud, 
  CloudOff,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [firebaseActive, setFirebaseActive] = useState(false);

  useEffect(() => {
    // Check if live firebase backend configuration is active
    setFirebaseActive(isFirebaseConfigured);

    // Watch auth changes (mock or live)
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ingresos', label: 'Ingresos', icon: UserPlus },
    { id: 'cartas', label: 'Cartas Oferta', icon: FileBadge2 },
    { id: 'movimientos', label: 'Movimientos', icon: TrendingUp },
    { id: 'catalogos', label: 'Catálogos', icon: BookOpen },
    { id: 'organigrama', label: 'Organigrama', icon: FolderTree }
  ];

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule currentUser={currentUser} onNavigate={setActiveModule} />;
      case 'ingresos':
        return <IngresosModule currentUser={currentUser} />;
      case 'cartas':
        return <CartasModule />;
      case 'movimientos':
        return <MovimientosModule currentUser={currentUser} />;
      case 'catalogos':
        return <CatalogosModule />;
      case 'organigrama':
        return <OrganigramaModule />;
      default:
        return <DashboardModule currentUser={currentUser} onNavigate={setActiveModule} />;
    }
  };

  const activeItem = menuItems.find(item => item.id === activeModule);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-usil-blue-900 text-white border-r border-usil-blue-950/40">
        
        {/* USIL Corporate Brand Header */}
        <div className="p-6 border-b border-usil-blue-800/40 flex items-center gap-3 bg-gradient-to-r from-usil-blue-900 to-usil-blue-800">
          <div className="w-8 h-8 rounded-lg bg-usil-sky-500 flex items-center justify-center font-black text-white shadow-md text-sm">
            US
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide leading-none text-white">HR OPERATIONS</h1>
            <span className="text-[10px] font-bold text-usil-sky-300 uppercase tracking-widest mt-1 block">
              Management System
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-150 outline-none
                  ${isActive
                    ? 'bg-usil-sky-500 text-white shadow-lg shadow-usil-sky-500/30 ring-1 ring-usil-sky-400/60'
                    : 'text-usil-blue-200 hover:text-white hover:bg-usil-blue-800/50'
                  }`}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-usil-sky-300'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile footer info */}
        <div className="p-4 border-t border-usil-blue-800/40 bg-usil-blue-950/30">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-usil-blue-950/40 border border-usil-sky-500/20">
            <div className="w-9 h-9 rounded-full bg-usil-sky-500/20 flex items-center justify-center font-bold text-usil-sky-300 border border-usil-sky-500/40">
              {currentUser?.avatar || <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold truncate text-white leading-none">
                {currentUser?.displayName || 'Cargando...'}
              </h4>
              <span className="text-[9px] font-bold text-usil-sky-300 uppercase tracking-wider block mt-1">
                {currentUser?.role || 'Invitado'}
              </span>
            </div>
          </div>
        </div>

      </aside>

      {/* ── MOBILE MENU SIDEBAR ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/60 backdrop-blur-sm">
          <aside className="w-64 bg-usil-blue-900 text-white flex flex-col h-full animate-slide-in shadow-2xl border-r border-usil-blue-800/40">
            <div className="p-5 border-b border-usil-blue-800/40 flex items-center justify-between bg-gradient-to-r from-usil-blue-900 to-usil-blue-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-usil-sky-500 flex items-center justify-center font-black text-white text-sm">
                  US
                </div>
                <h1 className="font-extrabold text-xs tracking-wider text-white">HR OPS SYSTEM</h1>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-usil-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveModule(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold outline-none transition-all
                      ${isActive
                        ? 'bg-usil-sky-500 text-white shadow-md shadow-usil-sky-500/30'
                        : 'text-usil-blue-200 hover:text-white hover:bg-usil-blue-800/50'}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-usil-blue-800/40 bg-usil-blue-950/30">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-usil-blue-950/40 border border-usil-sky-500/20">
                <span className="text-xl">{currentUser?.avatar}</span>
                <div>
                  <h4 className="text-xs font-bold text-white leading-none">{currentUser?.displayName}</h4>
                  <span className="text-[9px] text-usil-sky-300 font-bold uppercase tracking-wider block mt-1">{currentUser?.role}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-usil-blue-100 px-6 flex items-center justify-between shrink-0 shadow-sm relative z-10">
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg border border-usil-blue-100 text-usil-blue-700 hover:bg-usil-blue-50 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-extrabold text-usil-blue-900 uppercase tracking-wider hidden sm:block">
              {activeItem?.label}
            </h2>
          </div>

          {/* Cloud Database Connection indicator */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors
              ${firebaseActive 
                ? 'bg-usil-sky-50 text-usil-sky-700 border-usil-sky-200' 
                : 'bg-usil-blue-50 text-usil-blue-600 border-usil-blue-100'}`}>
              {firebaseActive ? (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Firestore Cloud</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 animate-pulse" />
                  <span>Demo Mode (Local)</span>
                </>
              )}
            </div>
          </div>

        </header>

        {/* Page content window */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {renderModule()}
          </div>
        </div>

      </main>

    </div>
  );
}
