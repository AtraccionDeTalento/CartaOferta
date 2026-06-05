import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Search, ListFilter, Shield } from 'lucide-react';
import { buildAssetUrl } from '../../services/paths';
import { 
  getSucursales, 
  getDepartamentos, 
  getAreas, 
  getUnidades, 
  getPuestos,
  loadOrganizationalCatalog
} from '../../services/catalogos';

export const CatalogosModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SUCURSALES' | 'DEPARTAMENTOS' | 'AREAS' | 'UNIDADES' | 'PUESTOS' | 'CECOS'>('SUCURSALES');
  const [list, setList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadTab = async () => {
      setLoading(true);
      try {
        await loadOrganizationalCatalog();
        
        if (activeTab === 'SUCURSALES') {
          const res = await getSucursales();
          setList(res.map(x => ({ id: x.id, primary: x.nombre, secondary: `ID: ${x.id}` })));
        } else if (activeTab === 'DEPARTAMENTOS') {
          const res = await fetch(buildAssetUrl('data/normalized/departamentos.json')).then(r => r.json());
          setList(res.map((x: any) => ({ id: x.id, primary: x.nombre, secondary: `ID: ${x.id}` })));
        } else if (activeTab === 'AREAS') {
          const res = await fetch(buildAssetUrl('data/normalized/areas.json')).then(r => r.json());
          setList(res.map((x: any) => ({ id: x.id, primary: x.nombre || '(SIN ÁREA)', secondary: `ID: ${x.id}` })));
        } else if (activeTab === 'UNIDADES') {
          const res = await fetch(buildAssetUrl('data/normalized/unidades.json')).then(r => r.json());
          setList(res.map((x: any) => ({ id: x.id, primary: x.nombre, secondary: `ID: ${x.id}` })));
        } else if (activeTab === 'PUESTOS') {
          const res = await fetch(buildAssetUrl('data/normalized/puestos.json')).then(r => r.json());
          setList(res.map((x: any) => ({ id: x.id, primary: x.nombre, secondary: `Puesto ID: ${x.id}` })));
        } else if (activeTab === 'CECOS') {
          const res = await fetch(buildAssetUrl('data/normalized/cecos.json')).then(r => r.json());
          setList(res.map((x: any) => ({ id: x.codigo, primary: x.codigo, secondary: x.descripcion })));
        }
      } catch (error) {
        console.error("Error loading catalog tab:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTab();
  }, [activeTab]);

  const filteredList = list.filter((item) =>
    item.primary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.secondary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs: { key: typeof activeTab; label: string; count?: number }[] = [
    { key: 'SUCURSALES', label: 'Sucursales' },
    { key: 'DEPARTAMENTOS', label: 'Departamentos' },
    { key: 'AREAS', label: 'Áreas' },
    { key: 'UNIDADES', label: 'Unidades' },
    { key: 'PUESTOS', label: 'Puestos (612)' },
    { key: 'CECOS', label: 'Centro de Costos (292)' }
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Catálogos Maestros</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5 font-sans">
            Tablas del organigrama institucional cargadas desde el núcleo organizacional Libro2.xlsx
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-slate-500" />
          <span>Solo Lectura (Sincronizado)</span>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap items-center border-b border-slate-200 gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearchTerm('');
              }}
              className={`px-4.5 py-3 text-xs font-bold transition-all border-b-2 outline-none
                ${isActive 
                  ? 'border-usil-blue-600 text-usil-blue-700 font-extrabold' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-center gap-2">
            <ListFilter className="w-4.5 h-4.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {activeTab} ({filteredList.length} registros)
            </span>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all text-slate-700 font-medium"
            />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="text-sm text-slate-400 font-semibold animate-pulse">Cargando catálogo...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[500px] overflow-y-auto pr-2">
              {filteredList.map((item, idx) => (
                <div 
                  key={idx} 
                  className="p-3.5 bg-slate-50/50 border border-slate-100 rounded-lg transition-all hover:bg-white hover:shadow-sm hover:border-slate-200"
                >
                  <div className="font-bold text-slate-800 text-xs truncate" title={item.primary}>
                    {item.primary}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono font-bold mt-1">
                    {item.secondary}
                  </div>
                </div>
              ))}

              {filteredList.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-450 font-semibold">
                  No se encontraron registros coincidentes
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
