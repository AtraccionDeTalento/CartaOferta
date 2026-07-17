import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import {
  Users,
  FileText,
  CheckCircle,
  FileClock,
  TrendingUp,
  Settings,
  HelpCircle,
  X
} from 'lucide-react';
import { subscribeToCollection } from '../../services/firestore';
import { UserProfile } from '../../services/auth';

interface DashboardModuleProps {
  currentUser: UserProfile | null;
  onNavigate: (module: string) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ currentUser, onNavigate }) => {
  const [showGuide, setShowGuide] = useState(false);
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
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold font-sans">
              ¡Hola, {currentUser?.displayName || 'Usuario'}!
            </h1>
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 text-[11px] font-bold bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              ¿Cómo funciona?
            </button>
          </div>
          <p className="text-sm text-usil-blue-100 mt-2 font-medium">
            Le damos la bienvenida al HR Operations Management System. Aquí puede gestionar solicitudes de ingreso, emitir cartas de oferta salarial validadas y registrar los movimientos de personal.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
          <Users className="w-80 h-80" />
        </div>
      </div>

      {/* Guía de Operación (modal, bajo demanda) */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-4">
              Flujo Colaborativo en 3 Pasos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100/60">
                <div className="w-8 h-8 rounded-full bg-usil-blue-100 text-usil-blue-700 font-extrabold flex items-center justify-center text-xs shrink-0">1</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Business Partner</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Registra la solicitud del candidato con CECO y reglas salariales aplicadas.</p>
                </div>
              </div>
              <div className="flex gap-3 p-4 bg-emerald-50/20 rounded-xl border border-emerald-100/40">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-extrabold flex items-center justify-center text-xs shrink-0">2</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Compensaciones</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Aprueba y genera la Carta Oferta en PDF automáticamente.</p>
                </div>
              </div>
              <div className="flex gap-3 p-4 bg-purple-50/20 rounded-xl border border-purple-100/40">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-xs shrink-0">3</div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Nómina</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Registra la firma y sincroniza el cambio con el core Adryan.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
