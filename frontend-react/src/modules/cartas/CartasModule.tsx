import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { subscribeToCollection } from '../../services/firestore';
import { getCartaTemplateMeta } from '../../services/cartas';
import { Download, FileBadge2, Search, Sparkles } from 'lucide-react';
import { PDFPreview } from '../../components/PDFPreview';

export const CartasModule: React.FC = () => {
  const [cartas, setCartas] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCarta, setSelectedCarta] = useState<any | null>(null);

  useEffect(() => {
    const unsubCartas = subscribeToCollection('cartas_oferta', (list) => {
      const sorted = [...list].sort((a, b) => Number(b.correlativo || 0) - Number(a.correlativo || 0));
      setCartas(sorted);
      setSelectedCarta((current: any) => sorted.find((item) => item.id === current?.id) || current || sorted[0] || null);
    });
    const unsubSolicitudes = subscribeToCollection('solicitudes_ingreso', (list) => {
      setSolicitudes(list);
    });

    return () => {
      unsubCartas();
      unsubSolicitudes();
    };
  }, []);

  const enriched = useMemo(() => {
    return cartas
      .map((carta) => {
        const solicitud = solicitudes.find((item) => item.id === carta.solicitud_id);
        const templateMeta = getCartaTemplateMeta(carta.plantilla_usada);
        return {
          ...carta,
          solicitud,
          templateMeta,
        };
      })
      .filter((item) => {
        const haystack = `${item.nombre_colaborador || ''} ${item.puesto || ''} ${item.plantilla_usada || ''}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      });
  }, [cartas, solicitudes, search]);

  const handleDownload = () => {
    if (!selectedCarta?.solicitud) return;
    const element = document.getElementById('cartas-preview-download');
    if (element instanceof HTMLButtonElement) {
      element.click();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cartas Oferta</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Vista operativa de cartas generadas, plantillas usadas y descarga inmediata.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Slice portado desde el frontend legado</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Repositorio de Cartas</h2>
              <p className="text-[11px] text-slate-400 mt-1">Cada carta emitida queda trazada con plantilla y correlativo.</p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por colaborador o plantilla"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none transition-all focus:border-usil-blue-500 focus:bg-white focus:ring-4 focus:ring-usil-blue-500/10"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {enriched.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-400">
                No hay cartas generadas todavia.
              </div>
            )}
            {enriched.map((carta) => {
              const isActive = selectedCarta?.id === carta.id;
              return (
                <button
                  key={carta.id}
                  type="button"
                  onClick={() => setSelectedCarta(carta)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${isActive ? 'border-usil-blue-300 bg-usil-blue-50 shadow-md shadow-usil-blue-100/70' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{carta.templateMeta?.emoji || '📄'}</span>
                        <span className="text-sm font-bold text-slate-800">#{carta.correlativo || '—'}</span>
                        <Badge state={carta.estado || 'GENERADA'} />
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-700">{carta.nombre_colaborador || 'Colaborador sin nombre'}</div>
                      <div className="mt-1 text-xs text-slate-500">{carta.puesto || 'Puesto no especificado'}</div>
                    </div>
                    <FileBadge2 className={`h-5 w-5 ${isActive ? 'text-usil-blue-700' : 'text-slate-300'}`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>{carta.plantilla_usada || 'Sin plantilla'}</span>
                    <span>{carta.created_at ? new Date(carta.created_at).toLocaleString() : 'Sin fecha'}</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Previsualizacion de Carta</h2>
              <p className="text-[11px] text-slate-400 mt-1">La misma previsualizacion operativa sirve como descarga inmediata del PDF.</p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!selectedCarta?.solicitud}
              className="inline-flex items-center gap-2 rounded-lg bg-usil-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-usil-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Descargar carta</span>
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedCarta?.solicitud ? (
              <div className="flex min-h-[560px] items-center justify-center bg-slate-50 text-sm font-medium text-slate-400">
                Seleccione una carta para ver la previsualizacion.
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-white/90 px-6 py-3 backdrop-blur">
                  <span className="text-lg">{selectedCarta.templateMeta?.emoji || '📄'}</span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{selectedCarta.plantilla_usada}</div>
                    <div className="text-[11px] text-slate-400">{selectedCarta.templateMeta?.desc || 'Plantilla operativa activa para esta carta.'}</div>
                  </div>
                </div>
                <div className="pt-16">
                  <PDFPreview solicitud={selectedCarta.solicitud} downloadButtonId="cartas-preview-download" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
