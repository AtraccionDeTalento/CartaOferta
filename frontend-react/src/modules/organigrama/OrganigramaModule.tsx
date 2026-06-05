import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { ChevronRight, ChevronDown, Network, Search, Briefcase, Hash } from 'lucide-react';
import { getSucursales, loadOrganizationalCatalog, Sucursal } from '../../services/catalogos';
import { buildAssetUrl } from '../../services/paths';

interface TreePuesto {
  id: number;
  nombre: string;
  ceco: string;
}

interface TreeUnidad {
  id: number;
  nombre: string;
  puestos: TreePuesto[];
  isOpen?: boolean;
}

interface TreeArea {
  id: number;
  nombre: string;
  unidades: TreeUnidad[];
  isOpen?: boolean;
}

interface TreeDept {
  id: number;
  nombre: string;
  areas: TreeArea[];
  isOpen?: boolean;
}

export const OrganigramaModule: React.FC = () => {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [selectedSucId, setSelectedSucId] = useState<number | null>(null);
  const [treeData, setTreeData] = useState<TreeDept[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Loaded catalogs references
  useEffect(() => {
    const fetchSucs = async () => {
      await loadOrganizationalCatalog();
      const list = await getSucursales();
      setSucursales(list);
      if (list.length > 0) {
        setSelectedSucId(list[0].id);
      }
    };
    fetchSucs();
  }, []);

  // Build tree based on sucursal ID
  useEffect(() => {
    if (!selectedSucId) return;

    const buildTree = async () => {
      setLoading(true);
      try {
        const [
          depts,
          areas,
          unidades,
          puestos,
          cecos,
          estData
        ] = await Promise.all([
          fetch(buildAssetUrl('data/normalized/departamentos.json')).then(r => r.json()),
          fetch(buildAssetUrl('data/normalized/areas.json')).then(r => r.json()),
          fetch(buildAssetUrl('data/normalized/unidades.json')).then(r => r.json()),
          fetch(buildAssetUrl('data/normalized/puestos.json')).then(r => r.json()),
          fetch(buildAssetUrl('data/normalized/cecos.json')).then(r => r.json()),
          fetch(buildAssetUrl('data/normalized/estructura_organizacional.json')).then(r => r.json())
        ]);

        const cecosMap = new Map<string, string>();
        cecos.forEach((c: any) => cecosMap.set(c.codigo, c.descripcion));

        // Filter relations for this sucursal
        const rels = estData.filter((e: any) => e.sucursal_id === selectedSucId);

        // Group relations into nested structures
        const deptMap = new Map<number, TreeDept>();

        rels.forEach((r: any) => {
          const deptObj = depts.find((d: any) => d.id === r.departamento_id);
          const areaObj = areas.find((a: any) => a.id === r.area_id);
          const uniObj = unidades.find((u: any) => u.id === r.unidad_id);
          const puestoObj = puestos.find((p: any) => p.id === r.puesto_id);

          if (!deptObj) return;

          // 1. Ensure Department
          if (!deptMap.has(deptObj.id)) {
            deptMap.set(deptObj.id, {
              id: deptObj.id,
              nombre: deptObj.nombre,
              areas: [],
              isOpen: false
            });
          }
          const treeDept = deptMap.get(deptObj.id)!;

          // 2. Ensure Area (use 0 for null/empty area)
          const areaId = areaObj ? areaObj.id : 0;
          const areaName = areaObj ? areaObj.nombre : '(SIN ÁREA)';

          let treeArea = treeDept.areas.find(a => a.id === areaId);
          if (!treeArea) {
            treeArea = {
              id: areaId,
              nombre: areaName,
              unidades: [],
              isOpen: false
            };
            treeDept.areas.push(treeArea);
          }

          // 3. Ensure Unidad
          if (uniObj) {
            let treeUni = treeArea.unidades.find(u => u.id === uniObj.id);
            if (!treeUni) {
              treeUni = {
                id: uniObj.id,
                nombre: uniObj.nombre,
                puestos: [],
                isOpen: false
              };
              treeArea.unidades.push(treeUni);
            }

            // 4. Add Puesto
            if (puestoObj) {
              const cecoDesc = r.ceco_code ? `${r.ceco_code} - ${cecosMap.get(r.ceco_code) || ''}` : '—';
              const alreadyHas = treeUni.puestos.some(p => p.id === puestoObj.id);
              if (!alreadyHas) {
                treeUni.puestos.push({
                  id: puestoObj.id,
                  nombre: puestoObj.nombre,
                  ceco: cecoDesc
                });
              }
            }
          }
        });

        // Convert Map to array
        const sortedTree = Array.from(deptMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        
        // Default first department to open
        if (sortedTree.length > 0) {
          sortedTree[0].isOpen = true;
        }

        setTreeData(sortedTree);
      } catch (error) {
        console.error("Error building organizational tree:", error);
      } finally {
        setLoading(false);
      }
    };

    buildTree();
  }, [selectedSucId]);

  // Toggle handlers
  const toggleDept = (deptId: number) => {
    setTreeData(prev =>
      prev.map(d => d.id === deptId ? { ...d, isOpen: !d.isOpen } : d)
    );
  };

  const toggleArea = (deptId: number, areaId: number) => {
    setTreeData(prev =>
      prev.map(d => {
        if (d.id !== deptId) return d;
        return {
          ...d,
          areas: d.areas.map(a => a.id === areaId ? { ...a, isOpen: !a.isOpen } : a)
        };
      })
    );
  };

  const toggleUnidad = (deptId: number, areaId: number, uniId: number) => {
    setTreeData(prev =>
      prev.map(d => {
        if (d.id !== deptId) return d;
        return {
          ...d,
          areas: d.areas.map(a => {
            if (a.id !== areaId) return a;
            return {
              ...a,
              unidades: a.unidades.map(u => u.id === uniId ? { ...u, isOpen: !u.isOpen } : u)
            };
          })
        };
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Organigrama Interactivo</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Explore las dependencias y jerarquías organizacionales por sucursal
          </p>
        </div>
      </div>

      {/* Select Sucursal Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4.5 border border-slate-100 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-usil-blue-700 shrink-0" />
          <span className="text-sm font-semibold text-slate-700">Ver Sucursal:</span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {sucursales.map((suc) => (
            <button
              key={suc.id}
              onClick={() => setSelectedSucId(suc.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-[0.98] border
                ${selectedSucId === suc.id
                  ? 'bg-usil-blue-600 border-usil-blue-600 text-white font-extrabold ring-4 ring-usil-blue-100'
                  : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                }`}
            >
              {suc.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Tree Visualizer */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="text-sm text-slate-400 font-semibold animate-pulse">Construyendo árbol jerárquico...</span>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[650px] overflow-y-auto pr-2">
              {treeData.map((dept) => (
                <div key={dept.id} className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                  
                  {/* Departamento Row */}
                  <button
                    onClick={() => toggleDept(dept.id)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100/70 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {dept.isOpen ? (
                        <ChevronDown className="w-4.5 h-4.5 text-slate-550 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4.5 h-4.5 text-slate-550 shrink-0" />
                      )}
                      <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        DEPARTAMENTO: {dept.nombre}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-250 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                      {dept.areas.length} áreas / subcategorías
                    </span>
                  </button>

                  {/* Areas container */}
                  {dept.isOpen && (
                    <div className="p-4.5 pl-8 border-t border-slate-50 space-y-3 bg-slate-50/20">
                      {dept.areas.map((area) => (
                        <div key={area.id} className="border border-slate-100 rounded-lg overflow-hidden bg-white">
                          
                          {/* Area Row */}
                          <button
                            onClick={() => toggleArea(dept.id, area.id)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              {area.isOpen ? (
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span className="text-xs font-bold text-slate-700">
                                ÁREA: {area.nombre}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-semibold">
                              {area.unidades.length} unidades
                            </span>
                          </button>

                          {/* Unidades container */}
                          {area.isOpen && (
                            <div className="p-3 pl-6 border-t border-slate-100/50 space-y-2 bg-slate-50/10">
                              {area.unidades.map((uni) => (
                                <div key={uni.id} className="border border-slate-100/60 rounded-md overflow-hidden bg-white">
                                  
                                  {/* Unidad Row */}
                                  <button
                                    onClick={() => toggleUnidad(dept.id, area.id, uni.id)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50/20 hover:bg-slate-50/50 transition-colors text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      {uni.isOpen ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      )}
                                      <span className="text-xs font-semibold text-slate-650">
                                        UNIDAD: {uni.nombre}
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-slate-400">
                                      {uni.puestos.length} puestos
                                    </span>
                                  </button>

                                  {/* Puestos list */}
                                  {uni.isOpen && (
                                    <div className="p-2.5 pl-6 border-t border-slate-100/40 space-y-2 divide-y divide-slate-50 bg-slate-50/5">
                                      {uni.puestos.map((puesto) => (
                                        <div key={puesto.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 text-xs">
                                          <div className="flex items-center gap-2 text-slate-700">
                                            <Briefcase className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                                            <span className="font-bold">{puesto.nombre}</span>
                                          </div>
                                          
                                          <div className="flex items-center gap-1 mt-1 sm:mt-0 text-[10px] text-slate-400 font-mono">
                                            <Hash className="w-3 h-3 text-slate-350" />
                                            <span>CECO: <strong className="text-slate-600 font-mono bg-slate-100 px-1 rounded">{puesto.ceco}</strong></span>
                                          </div>
                                        </div>
                                      ))}

                                      {uni.puestos.length === 0 && (
                                        <div className="py-2 text-[10px] text-slate-400 italic text-center">
                                          No hay puestos mapeados en esta unidad
                                        </div>
                                      )}
                                    </div>
                                  )}

                                </div>
                              ))}

                              {area.unidades.length === 0 && (
                                <div className="py-3 text-[10px] text-slate-400 italic text-center">
                                  No hay unidades en esta área
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}

              {treeData.length === 0 && (
                <div className="py-20 text-center text-slate-400">
                  No hay datos estructurados disponibles para esta sucursal
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
