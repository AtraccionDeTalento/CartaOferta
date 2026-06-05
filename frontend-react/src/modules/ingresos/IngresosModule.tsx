import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { DataTable } from '../../components/DataTable';
import { DynamicForm } from '../../components/DynamicForm';
import { WorkflowTimeline } from '../../components/WorkflowTimeline';
import { ApprovalFlow } from '../../components/ApprovalFlow';
import { PDFPreview } from '../../components/PDFPreview';
import { subscribeToCollection, addDoc, updateDoc } from '../../services/firestore';
import { UserProfile } from '../../services/auth';
import { Plus, ChevronLeft, Eye, Clock, User, Calendar, DollarSign, Briefcase } from 'lucide-react';

interface IngresosModuleProps {
  currentUser: UserProfile | null;
}

export const IngresosModule: React.FC<IngresosModuleProps> = ({ currentUser }) => {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'DETAILS'>('LIST');

  const createDemoRequestPayload = () => ({
    nombres_apellidos: 'POSTULANTE DEMO USIL',
    dni: '00000000',
    tipo_ingreso: 'Ingreso sin Reemplazo',
    sucursal: 'UNIVERSIDAD',
    departamento: 'TECNOLOGIA',
    area: 'PRODUCTO DIGITAL',
    unidad: 'USIL',
    puesto: 'ANALISTA FUNCIONAL',
    codigo_cr: 'DEMO-001',
    salario: 3500,
    modalidad: 'FULL TIME',
    tipo_personal: 'EMPLEADO',
    categoria_trabajador: 'SUJETO A FISCALIZACION',
    periodo_prueba: '03 meses',
    jornada: '48',
    tiempo_contrato: '6 meses',
    nombre_jefe_directo: 'JEFE DEMO',
    fecha_tentativa_ingreso: new Date().toISOString().slice(0, 10),
    fecha_termino_contrato: null,
    incluye_eps: true,
    incluye_movilidad: false,
    monto_movilidad: 0,
    incluye_tarjeta_alimentos: false,
    monto_tarjeta_alimentos: 0,
    incluye_bono_transporte: false,
    monto_bono_transporte: 0,
    plantilla_carta: 'CO BASE',
    fuente_candidatura_url: 'https://example.com/candidato-demo',
    resumen_candidato: 'Solicitud demo creada para validar flujo, previsualizacion PDF y carga rapida.',
    archivos_referencia: [
      { nombre: 'CV_DEMO.pdf', tipo: 'application/pdf', tamanoKb: 128 },
      { nombre: 'Briefing_BP.docx', tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', tamanoKb: 64 },
    ],
    captura_rapida: true,
  });

  // Real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeToCollection('solicitudes_ingreso', (list) => {
      // Sort newest first
      const sorted = [...list].sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setSolicitudes(sorted);
      
      // If we are looking at a request, keep it synced in real-time
      if (selectedRequest) {
        const updated = list.find(x => x.id === selectedRequest.id);
        if (updated) {
          setSelectedRequest(updated);
        }
      }
    });
    return unsubscribe;
  }, [selectedRequest]);

  const handleCreateRequest = async (formData: any) => {
    // Generate correlativo
    const nextCorrelativo = solicitudes.length > 0 
      ? Math.max(...solicitudes.map(s => Number(s.correlativo || 0))) + 1
      : 2413;

    const newRequest = {
      ...formData,
      correlativo: nextCorrelativo,
      estado: 'BORRADOR', // Starts as draft
      historial: [
        {
          fecha: new Date().toISOString(),
          usuario: currentUser?.displayName || 'Sistema',
          rol: currentUser?.role || 'Business Partner',
          estado_anterior: '-',
          estado_nuevo: 'BORRADOR',
          comentario: 'Solicitud creada en borrador.'
        }
      ]
    };

    try {
      await addDoc('solicitudes_ingreso', newRequest);
      setViewMode('LIST');
    } catch (error) {
      console.error("Error creating request:", error);
    }
  };

  const handleCreateDemoRequest = async () => {
    const nextCorrelativo = solicitudes.length > 0
      ? Math.max(...solicitudes.map(s => Number(s.correlativo || 0))) + 1
      : 2413;

    try {
      await addDoc('solicitudes_ingreso', {
        ...createDemoRequestPayload(),
        correlativo: nextCorrelativo,
        estado: 'BORRADOR',
        historial: [
          {
            fecha: new Date().toISOString(),
            usuario: currentUser?.displayName || 'Sistema',
            rol: currentUser?.role || 'Business Partner',
            estado_anterior: '-',
            estado_nuevo: 'BORRADOR',
            comentario: 'Solicitud demo creada para pruebas rapidas del flujo y la carta oferta.'
          }
        ]
      });
    } catch (error) {
      console.error('Error creating demo request:', error);
    }
  };

  const handleUpdateRequest = async (formData: any) => {
    if (!selectedRequest) return;
    try {
      await updateDoc('solicitudes_ingreso', selectedRequest.id, {
        ...formData,
        historial: [
          ...(selectedRequest.historial || []),
          {
            fecha: new Date().toISOString(),
            usuario: currentUser?.displayName || 'Sistema',
            rol: currentUser?.role || 'Business Partner',
            estado_anterior: selectedRequest.estado,
            estado_nuevo: selectedRequest.estado,
            comentario: 'Datos de la solicitud modificados.'
          }
        ]
      });
      setViewMode('LIST');
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error updating request:", error);
    }
  };

  // DataTable column specs
  const columns = [
    {
      header: "N° Corr",
      accessor: (row: any) => <span className="font-bold text-slate-900">{row.correlativo}</span>
    },
    {
      header: "Colaborador",
      accessor: (row: any) => (
        <div>
          <div className="font-bold text-slate-800">{row.nombres_apellidos}</div>
          <div className="text-[10px] text-slate-400 font-medium">DNI/CEX: {row.dni}</div>
        </div>
      )
    },
    {
      header: "Puesto / Sede",
      accessor: (row: any) => (
        <div>
          <div className="font-medium text-slate-700">{row.puesto}</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{row.unidad} - {row.sucursal}</div>
        </div>
      )
    },
    {
      header: "CECO",
      accessor: (row: any) => <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-mono">{row.codigo_cr}</code>
    },
    {
      header: "Salario",
      accessor: (row: any) => <span className="font-bold text-slate-700">S/ {Number(row.salario || 0).toLocaleString()}</span>
    },
    {
      header: "Estado",
      accessor: (row: any) => <Badge state={row.estado} />
    },
    {
      header: "Acción",
      accessor: (row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRequest(row);
            setViewMode('DETAILS');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-usil-blue-50 hover:text-usil-blue-700 hover:border-usil-blue-200 transition-colors shadow-sm"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Ver Flujo</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Solicitudes de Ingreso</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Gestión colaborativa del proceso de contratación y compensaciones
          </p>
        </div>
        
        {viewMode === 'LIST' && (currentUser?.role === 'Business Partner' || currentUser?.role === 'Admin') && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateDemoRequest}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-usil-blue-200 text-usil-blue-700 hover:bg-usil-blue-50 rounded-lg text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.98]"
            >
              <span>Cargar Demo</span>
            </button>

            <button
              onClick={() => {
                setSelectedRequest(null);
                setViewMode('FORM');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-usil-blue-700 hover:bg-usil-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Solicitud</span>
            </button>
          </div>
        )}

        {viewMode !== 'LIST' && (
          <button
            onClick={() => {
              setViewMode('LIST');
              setSelectedRequest(null);
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
            {solicitudes.length === 0 && (currentUser?.role === 'Business Partner' || currentUser?.role === 'Admin') && (
              <div className="mb-5 rounded-2xl border border-usil-blue-100 bg-usil-blue-50/70 p-4 text-sm text-usil-blue-900">
                <div className="font-bold">No hay registros cargados en este entorno.</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Usa Cargar Demo para crear una solicitud con previsualizacion de carta oferta y validar el formato completo con imagenes.
                </p>
              </div>
            )}
            <DataTable
              data={solicitudes}
              columns={columns}
              searchPlaceholder="Buscar por nombre, puesto o código..."
              searchFieldGetter={(row) => `${row.nombres_apellidos} ${row.puesto} ${row.codigo_cr}`}
              onRowClick={(row) => {
                setSelectedRequest(row);
                setViewMode('DETAILS');
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── FORM VIEW (Add/Edit) ── */}
      {viewMode === 'FORM' && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-slate-800">
              {selectedRequest ? 'Editar Solicitud de Ingreso' : 'Crear Solicitud de Ingreso'}
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <DynamicForm
              initialData={selectedRequest}
              onSubmit={selectedRequest ? handleUpdateRequest : handleCreateRequest}
              onCancel={() => {
                setViewMode('LIST');
                setSelectedRequest(null);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* ── DETAILS & WORKFLOW VIEW ── */}
      {viewMode === 'DETAILS' && selectedRequest && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Info and Approval Controls (Left Column) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Timeline Stepper */}
            <WorkflowTimeline currentState={selectedRequest.estado} />

            {/* Request Core Details */}
            <Card>
              <CardHeader className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-usil-blue-700" />
                  <span className="text-sm font-bold text-slate-800">Detalles de la Solicitud</span>
                </div>
                <Badge state={selectedRequest.estado} />
              </CardHeader>
              <CardContent className="p-6.5 space-y-5">
                <div className="grid grid-cols-2 gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidato</span>
                    <span className="text-sm font-bold text-slate-800">{selectedRequest.nombres_apellidos}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">DNI/CEX</span>
                    <span className="text-sm text-slate-600 font-semibold">{selectedRequest.dni}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Puesto</span>
                    <span className="text-sm text-slate-700 font-semibold">{selectedRequest.puesto}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Centro Costo (CECO)</span>
                    <code className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono font-bold inline-block mt-0.5">{selectedRequest.codigo_cr}</code>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estructura Organizacional</span>
                    <div className="text-xs text-slate-600 space-y-0.5 mt-1 font-medium">
                      <div><strong className="text-slate-800">Sucursal:</strong> {selectedRequest.sucursal}</div>
                      <div><strong className="text-slate-800">Dep:</strong> {selectedRequest.departamento}</div>
                      {selectedRequest.area && <div><strong className="text-slate-800">Área:</strong> {selectedRequest.area}</div>}
                      <div><strong className="text-slate-800">Unidad:</strong> {selectedRequest.unidad}</div>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo Ingreso</span>
                    <span className="text-sm text-slate-600 font-semibold">{selectedRequest.tipo_ingreso}</span>
                    {selectedRequest.codigo_reemplazo && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800 font-semibold">
                        Reemplaza a: {selectedRequest.nombre_reemplazo} ({selectedRequest.codigo_reemplazo})
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salario Mensual</span>
                    <span className="text-sm text-slate-800 font-bold">S/ {Number(selectedRequest.salario || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modalidad</span>
                    <span className="text-sm text-slate-600 font-semibold">{selectedRequest.modalidad}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jefe Directo</span>
                    <span className="text-sm text-slate-600 font-semibold">{selectedRequest.nombre_jefe_directo}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tentativa Ingreso</span>
                    <span className="text-sm text-slate-600 font-bold">{selectedRequest.fecha_tentativa_ingreso}</span>
                  </div>
                </div>

                {(selectedRequest.fuente_candidatura_url || selectedRequest.resumen_candidato || (Array.isArray(selectedRequest.archivos_referencia) && selectedRequest.archivos_referencia.length > 0)) && (
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material de Origen</span>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                        Referencias capturadas en la carga rapida para completar la solicitud o validar la carta oferta.
                      </p>
                    </div>

                    {selectedRequest.fuente_candidatura_url && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Link de Referencia</span>
                        <a
                          href={selectedRequest.fuente_candidatura_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex rounded-lg border border-usil-blue-100 bg-usil-blue-50 px-3 py-2 text-xs font-semibold text-usil-blue-700 hover:bg-usil-blue-100"
                        >
                          Abrir enlace del candidato
                        </a>
                      </div>
                    )}

                    {selectedRequest.resumen_candidato && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resumen / Briefing</span>
                        <div className="mt-1 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 whitespace-pre-line">
                          {selectedRequest.resumen_candidato}
                        </div>
                      </div>
                    )}

                    {Array.isArray(selectedRequest.archivos_referencia) && selectedRequest.archivos_referencia.length > 0 && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Archivos de Referencia</span>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {selectedRequest.archivos_referencia.map((file: any, index: number) => (
                            <div key={`${file.nombre || 'archivo'}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              <div className="font-semibold text-slate-700">{file.nombre || 'Archivo sin nombre'}</div>
                              <div className="mt-1 text-[11px] text-slate-400">{file.tipo || 'Archivo'} · {file.tamanoKb || 0} KB</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Approval Stepper Panel */}
            <ApprovalFlow
              solicitud={selectedRequest}
              currentUser={currentUser}
              onTransitionSuccess={() => {
                // Refresh list or trigger success alerts
              }}
            />

            {/* Traceability Audit Trail (Historial) */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-usil-blue-700" />
                  <span className="text-sm font-bold text-slate-800">Historial de Auditoría (Trazabilidad)</span>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flow-root">
                  <ul className="-mb-8">
                    {Array.isArray(selectedRequest.historial) && selectedRequest.historial.map((entry: any, entryIdx: number) => (
                      <li key={entryIdx}>
                        <div className="relative pb-8">
                          {entryIdx !== selectedRequest.historial.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                                {entry.rol.charAt(0)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5">
                              <div className="text-xs text-slate-500 font-semibold">
                                <span className="font-bold text-slate-800">{entry.usuario}</span> ({entry.rol}) {' '}
                                cambió el estado a <Badge state={entry.estado_nuevo} className="ml-1" />
                              </div>
                              {entry.comentario && (
                                <p className="mt-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed font-medium">
                                  {entry.comentario}
                                </p>
                              )}
                              <div className="text-[10px] text-slate-400 mt-1 font-bold">
                                {new Date(entry.fecha).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Letter PDF Live Preview (Right Column) */}
          <div className="lg:col-span-5">
            <PDFPreview
              solicitud={selectedRequest}
              onLetterGenerated={() => {
                // Succeeded
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
