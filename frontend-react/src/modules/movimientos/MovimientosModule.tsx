import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/DataTable';
import { subscribeToCollection, addDoc, updateDoc } from '../../services/firestore';
import { UserProfile } from '../../services/auth';
import { Plus, ChevronLeft, Save, Sparkles, CheckSquare, RefreshCw, AlertCircle } from 'lucide-react';

interface MovimientosModuleProps {
  currentUser: UserProfile | null;
}

export const MovimientosModule: React.FC<MovimientosModuleProps> = ({ currentUser }) => {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [selectedMov, setSelectedMov] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'DETAILS'>('LIST');

  // Form states
  const [codigoColaborador, setCodigoColaborador] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargoActual, setCargoActual] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('Promoción');
  const [fechaCambio, setFechaCambio] = useState('');
  const [sucursal, setSucursal] = useState('UNIVERSIDAD');
  const [cargoNuevo, setCargoNuevo] = useState('');
  const [salarioActual, setSalarioActual] = useState(0);
  const [salarioNuevo, setSalarioNuevo] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = subscribeToCollection('movimientos', (list) => {
      // Sort newest first
      const sorted = [...list].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setMovimientos(sorted);

      if (selectedMov) {
        const updated = list.find(x => x.id === selectedMov.id);
        if (updated) setSelectedMov(updated);
      }
    });
    return unsubscribe;
  }, [selectedMov]);

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Quick validate
    const err: Record<string, string> = {};
    if (!codigoColaborador.trim()) err.codigo = "El código de colaborador es requerido (Ej: U00123).";
    if (!nombre.trim()) err.nombre = "El nombre del colaborador es requerido.";
    if (!cargoActual.trim()) err.cargoActual = "El cargo actual es requerido.";
    if (!cargoNuevo.trim()) err.cargoNuevo = "El cargo nuevo es requerido.";
    if (!fechaCambio) err.fechaCambio = "La fecha del cambio es requerida.";

    if (Object.keys(err).length > 0) {
      setErrors(err);
      return;
    }

    const newMov = {
      codigo_colaborador: codigoColaborador.toUpperCase().trim(),
      nombre: nombre.toUpperCase().trim(),
      cargo_actual: cargoActual.toUpperCase().trim(),
      tipo_documento: tipoDocumento,
      fecha_cambio: fechaCambio,
      sucursal: sucursal,
      cargo_nuevo: cargoNuevo.toUpperCase().trim(),
      salario_actual: Number(salarioActual),
      salario_nuevo: Number(salarioNuevo),
      adryan: "PENDIENTE",
      estado: "PENDIENTE",
      created_at: new Date().toISOString()
    };

    try {
      await addDoc('movimientos', newMov);
      setViewMode('LIST');
      resetForm();
    } catch (error) {
      console.error("Error creating movement:", error);
    }
  };

  const resetForm = () => {
    setCodigoColaborador('');
    setNombre('');
    setCargoActual('');
    setCargoNuevo('');
    setFechaCambio('');
    setSalarioActual(0);
    setSalarioNuevo(0);
    setErrors({});
  };

  const handleMarkAdryan = async (id: string, adryanStatus: string) => {
    try {
      await updateDoc('movimientos', id, {
        adryan: adryanStatus,
        estado: adryanStatus === 'SI' ? 'COMPLETADO' : 'PENDIENTE'
      });
    } catch (error) {
      console.error("Error updating Adryan status:", error);
    }
  };

  const columns = [
    {
      header: "Código",
      accessor: (row: any) => <span className="font-mono font-bold text-slate-800">{row.codigo_colaborador}</span>
    },
    {
      header: "Colaborador",
      accessor: (row: any) => <span className="font-bold text-slate-800">{row.nombre}</span>
    },
    {
      header: "Tipo Cambo",
      accessor: (row: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
          {row.tipo_documento}
        </span>
      )
    },
    {
      header: "Puesto Nuevo",
      accessor: (row: any) => (
        <div>
          <div className="font-semibold text-slate-700">{row.cargo_nuevo}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{row.sucursal}</div>
        </div>
      )
    },
    {
      header: "Fecha Cambio",
      accessor: (row: any) => <span className="font-medium text-slate-600">{row.fecha_cambio}</span>
    },
    {
      header: "Adryan Sync",
      accessor: (row: any) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border
          ${row.adryan === 'SI' 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : row.adryan === 'NO APLICA'
              ? 'bg-gray-50 text-gray-500 border-gray-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {row.adryan === 'SI' ? 'Sincronizado' : row.adryan === 'NO APLICA' ? 'No Aplica' : 'Pendiente'}
        </span>
      )
    },
    {
      header: "Acción",
      accessor: (row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMov(row);
            setViewMode('DETAILS');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-usil-blue-50 hover:text-usil-blue-700 hover:border-usil-blue-200 transition-colors shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ver Detalle</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Movimientos de Personal</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Sincronización de ascensos, transferencias y variaciones salariales con el core Adryan
          </p>
        </div>

        {viewMode === 'LIST' && (currentUser?.role === 'Business Partner' || currentUser?.role === 'Admin') && (
          <button
            onClick={() => {
              setSelectedMov(null);
              setViewMode('FORM');
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-usil-blue-700 hover:bg-usil-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Movimiento</span>
          </button>
        )}

        {viewMode !== 'LIST' && (
          <button
            onClick={() => {
              setViewMode('LIST');
              setSelectedMov(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver a la Lista</span>
          </button>
        )}
      </div>

      {/* ── LIST VIEW ── */}
      {viewMode === 'LIST' && (
        <Card>
          <CardContent className="p-6">
            <DataTable
              data={movimientos}
              columns={columns}
              searchPlaceholder="Buscar por código, colaborador o puesto..."
              searchFieldGetter={(row) => `${row.codigo_colaborador} ${row.nombre} ${row.cargo_nuevo}`}
              onRowClick={(row) => {
                setSelectedMov(row);
                setViewMode('DETAILS');
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── FORM VIEW ── */}
      {viewMode === 'FORM' && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-slate-800">Registrar Movimiento de Colaborador</h2>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleCreateMovement} className="space-y-5">
              {Object.keys(errors).length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Errores de validación:</span>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      {Object.values(errors).map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Código Colaborador <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={codigoColaborador}
                    onChange={(e) => setCodigoColaborador(e.target.value)}
                    placeholder="Ej: U00182"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nombres y Apellidos Colaborador <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: KARLA RIOS VILLACREZ"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Cargo Actual <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cargoActual}
                    onChange={(e) => setCargoActual(e.target.value)}
                    placeholder="Ej: ANALISTA DE RRHH"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Cargo Nuevo / Propuesto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={cargoNuevo}
                    onChange={(e) => setCargoNuevo(e.target.value)}
                    placeholder="Ej: COORDINADOR DE OPERACIONES"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tipo de Movimiento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={tipoDocumento}
                    onChange={(e) => setTipoDocumento(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4"
                  >
                    <option value="Promoción">Promoción</option>
                    <option value="Aumento de Sueldo">Aumento de Sueldo</option>
                    <option value="Traslado / Transferencia">Traslado / Transferencia</option>
                    <option value="Asignación de Movilidad">Asignación de Movilidad</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sucursal <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sucursal}
                    onChange={(e) => setSucursal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4"
                  >
                    <option value="UNIVERSIDAD">UNIVERSIDAD</option>
                    <option value="CSIR">CSIR</option>
                    <option value="POSTGRADO">POSTGRADO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Fecha de Cambio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fechaCambio}
                    onChange={(e) => setFechaCambio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Salario Actual (S/)
                  </label>
                  <input
                    type="number"
                    value={salarioActual || ''}
                    onChange={(e) => setSalarioActual(Number(e.target.value))}
                    placeholder="Ej: 3000"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Salario Nuevo Propuesto (S/)
                  </label>
                  <input
                    type="number"
                    value={salarioNuevo || ''}
                    onChange={(e) => setSalarioNuevo(Number(e.target.value))}
                    placeholder="Ej: 4200"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('LIST');
                    resetForm();
                  }}
                  className="px-5 py-2.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-usil-blue-600 hover:bg-usil-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
                >
                  <Save className="w-4.5 h-4.5" />
                  <span>Guardar Movimiento</span>
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── DETAILS VIEW ── */}
      {viewMode === 'DETAILS' && selectedMov && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-in">
          {/* Movement comparison (Left Column) */}
          <div className="lg:col-span-8 space-y-6">
            <Card>
              <CardHeader className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-800">
                  Comparativa de Movimiento de Personal
                </h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border
                  ${selectedMov.adryan === 'SI' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : selectedMov.adryan === 'NO APLICA'
                      ? 'bg-gray-50 text-gray-500 border-gray-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {selectedMov.adryan === 'SI' ? 'Procesado Adryan' : selectedMov.adryan === 'NO APLICA' ? 'No Aplica Sync' : 'Pendiente Sincronizar'}
                </span>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Current State */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Estado Actual</h3>
                    <div className="space-y-3.5">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-semibold uppercase">Colaborador</span>
                        <span className="text-sm font-bold text-slate-850">{selectedMov.nombre}</span>
                        <code className="block mt-0.5 text-xs text-slate-500 font-mono">Código: {selectedMov.codigo_colaborador}</code>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-semibold uppercase">Cargo Actual</span>
                        <span className="text-sm text-slate-700 font-semibold">{selectedMov.cargo_actual}</span>
                      </div>
                      {selectedMov.salario_actual > 0 && (
                        <div>
                          <span className="block text-[10px] text-slate-400 font-semibold uppercase">Salario Mensual</span>
                          <span className="text-sm text-slate-750 font-bold">S/ {selectedMov.salario_actual.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proposed Change */}
                  <div className="bg-usil-blue-50/30 rounded-xl p-5 border border-usil-blue-100/50">
                    <h3 className="text-xs font-bold text-usil-blue-600 uppercase tracking-wider mb-4">Cambios Propuestos ({selectedMov.tipo_documento})</h3>
                    <div className="space-y-3.5">
                      <div>
                        <span className="block text-[10px] text-usil-blue-500 font-semibold uppercase">Cargo Nuevo</span>
                        <span className="text-sm font-extrabold text-usil-blue-900">{selectedMov.cargo_nuevo}</span>
                        <span className="block mt-0.5 text-[10px] text-slate-500 font-bold uppercase">Sede: {selectedMov.sucursal}</span>
                      </div>
                      {selectedMov.salario_nuevo > 0 && (
                        <div>
                          <span className="block text-[10px] text-usil-blue-500 font-semibold uppercase">Salario Nuevo</span>
                          <span className="text-sm text-usil-blue-900 font-extrabold">S/ {selectedMov.salario_nuevo.toLocaleString()}</span>
                          {selectedMov.salario_actual > 0 && (
                            <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">
                              Incremento: +S/ {(selectedMov.salario_nuevo - selectedMov.salario_actual).toLocaleString()} (+{Math.round(((selectedMov.salario_nuevo - selectedMov.salario_actual) / selectedMov.salario_actual) * 100)}%)
                            </span>
                          )}
                        </div>
                      )}
                      <div>
                        <span className="block text-[10px] text-usil-blue-500 font-semibold uppercase">Fecha Efectiva</span>
                        <span className="text-sm text-slate-700 font-bold">{selectedMov.fecha_cambio}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sincronización con Adryan Actions (Right Column) */}
          <div className="lg:col-span-4 space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-bold text-slate-800">Panel de Operaciones</h3>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Una vez aprobados por compensaciones, los movimientos de personal deben cargarse en el sistema ERP Adryan para nómina.
                </p>

                {(currentUser?.role === 'Nómina' || currentUser?.role === 'Admin') ? (
                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleMarkAdryan(selectedMov.id, 'SI')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Sincronizado con Adryan</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleMarkAdryan(selectedMov.id, 'PENDIENTE')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-sm font-semibold transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Volver a Pendiente</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleMarkAdryan(selectedMov.id, 'NO APLICA')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg text-sm font-semibold transition-all"
                    >
                      <span>No Requiere Sincronización</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-500 font-medium">
                      Solo los usuarios con el rol de <strong>Nómina</strong> o <strong>Admin</strong> pueden gestionar la sincronización de Adryan.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
