import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { 
  Users, 
  FileText, 
  CheckCircle, 
  FileClock, 
  TrendingUp, 
  Settings, 
  ShieldAlert 
} from 'lucide-react';
import { subscribeToCollection } from '../../services/firestore';
import { MOCK_PROFILES, UserProfile, loginAsMockUser } from '../../services/auth';

interface DashboardModuleProps {
  currentUser: UserProfile | null;
  onNavigate: (module: string) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ currentUser, onNavigate }) => {
  const [stats, setStats] = useState({
    totalIngresos: 0,
    ingresosPendientes: 0,
    ingresosAprobados: 0,
    cartasEmitidas: 0,
    totalMovimientos: 0,
    movimientosPendientes: 0
  });

  useEffect(() => {
    // Subscribe to solicitudes and calculate stats dynamically
    const unsubSolicitudes = subscribeToCollection('solicitudes_ingreso', (list) => {
      const pending = list.filter(x => 
        ["BORRADOR", "PENDIENTE_BP", "PENDIENTE_COMPENSACIONES", "OBSERVADO"].includes(x.estado)
      ).length;
      const approved = list.filter(x => x.estado === 'APROBADO').length;
      const letters = list.filter(x => ['CARTA_EMITIDA', 'FIRMADO', 'NOMINA_COMPLETADO'].includes(x.estado)).length;

      setStats(prev => ({
        ...prev,
        totalIngresos: list.length,
        ingresosPendientes: pending,
        ingresosAprobados: approved,
        cartasEmitidas: letters
      }));
    });

    // Subscribe to movimientos
    const unsubMovimientos = subscribeToCollection('movimientos', (list) => {
      const pending = list.filter(x => x.estado === 'PENDIENTE').length;
      setStats(prev => ({
        ...prev,
        totalMovimientos: list.length,
        movimientosPendientes: pending
      }));
    });

    return () => {
      unsubSolicitudes();
      unsubMovimientos();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-usil-blue-800 to-usil-blue-600 text-white rounded-2xl p-7 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-2xl font-bold font-sans">
            ¡Hola, {currentUser?.displayName || 'Usuario'}!
          </h1>
          <p className="text-sm text-usil-blue-100 mt-2 font-medium">
            Le damos la bienvenida al HR Operations Management System. Aquí puede gestionar solicitudes de ingreso, emitir cartas de oferta salarial validadas y registrar los movimientos de personal.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
          <Users className="w-80 h-80" />
        </div>
      </div>

      {/* Guía Visual Rápida del Flujo de Trabajo (Poka-Yoke & Intuitive Helper) */}
      <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4">
          Guía de Operación: Flujo Colaborativo en 3 Pasos
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          
          {/* Paso 1 */}
          <div className="flex gap-4.5 p-4.5 bg-slate-50 rounded-xl border border-slate-100/60 relative">
            <div className="w-10 h-10 rounded-full bg-usil-blue-100 text-usil-blue-700 font-extrabold flex items-center justify-center text-sm shrink-0 shadow-inner">
              1
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Business Partner (BP)</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">
                Registra la solicitud del candidato. El formulario autocompleta el **CECO** dependiente y aplica las reglas salariales.
              </p>
              <span className="inline-block mt-2.5 text-[10px] font-bold text-usil-blue-600 bg-usil-blue-50 px-2 py-0.5 rounded border border-usil-blue-100">
                Paso Inicial
              </span>
            </div>
          </div>

          {/* Paso 2 */}
          <div className="flex gap-4.5 p-4.5 bg-emerald-50/20 rounded-xl border border-emerald-100/40 relative">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center text-sm shrink-0 shadow-inner">
              2
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Compensaciones (Débora)</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">
                Revisa y aprueba la solicitud. Al aprobarse, el sistema genera la **Carta Oferta** en PDF usando la plantilla automática.
              </p>
              <span className="inline-block mt-2.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Genera la Carta
              </span>
            </div>
          </div>

          {/* Paso 3 */}
          <div className="flex gap-4.5 p-4.5 bg-purple-50/20 rounded-xl border border-purple-100/40 relative">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-sm shrink-0 shadow-inner">
              3
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Operaciones / Nómina</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">
                Registra la firma del candidato aceptante y marca el cambio organizativo como sincronizado en el core **Adryan**.
              </p>
              <span className="inline-block mt-2.5 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                Cierre y Carga ERP
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Quick Switch Panel for Demo Mode */}
      <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3 text-amber-800">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            Consola Multi-Rol (Entorno Cloud Colaborativo)
          </h3>
        </div>
        <p className="text-xs text-amber-700 mb-4 leading-relaxed font-medium">
          El flujo de aprobación de compensaciones cambia dinámicamente según el rol. Use este simulador para cambiar de usuario y ver cómo varían los accesos del formulario y panel de aprobación:
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {MOCK_PROFILES.map((profile) => {
            const isSelected = currentUser?.uid === profile.uid;
            return (
              <button
                key={profile.uid}
                onClick={() => loginAsMockUser(profile)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm border active:scale-[0.98]
                  ${isSelected
                    ? 'bg-amber-600 border-amber-600 text-white font-extrabold ring-4 ring-amber-100'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="text-sm">{profile.avatar}</span>
                <span>{profile.displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Ingresos</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.totalIngresos}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pendientes Flujo</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.ingresosPendientes}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <FileClock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aprobados</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.ingresosAprobados}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cartas Emitidas</p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">{stats.cartasEmitidas}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Movimientos</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.totalMovimientos}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mov. Pendientes</p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">{stats.movimientosPendientes}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <FileClock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Quick Nav links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="hover:-translate-y-1 hover:shadow-lg duration-200">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-usil-blue-50 flex items-center justify-center text-usil-blue-700">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Solicitudes de Ingreso</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cree nuevas solicitudes de personal con campos jerárquicos autocompletados y supervise el flujo de aprobaciones de compensación.
            </p>
            <button
              onClick={() => onNavigate('ingresos')}
              className="text-xs font-bold text-usil-blue-700 hover:text-usil-blue-800 hover:underline pt-1 inline-block"
            >
              Ir a ingresos &rarr;
            </button>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-1 hover:shadow-lg duration-200">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Movimientos de Colaboradores</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Gestione ascensos, traslados, bonos y otros movimientos. Registre la aprobación y la sincronización con el sistema Adryan.
            </p>
            <button
              onClick={() => onNavigate('movimientos')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline pt-1 inline-block"
            >
              Ir a movimientos &rarr;
            </button>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-1 hover:shadow-lg duration-200">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Catálogos &amp; Organigrama</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Explore los catálogos organizacionales y visualice la jerarquía de cargos por sucursales en forma de organigrama interactivo.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => onNavigate('organigrama')}
                className="text-xs font-bold text-purple-700 hover:text-purple-800 hover:underline pt-1 inline-block"
              >
                Organigrama &rarr;
              </button>
              <button
                onClick={() => onNavigate('catalogos')}
                className="text-xs font-bold text-purple-700 hover:text-purple-800 hover:underline pt-1 inline-block"
              >
                Catálogos &rarr;
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
