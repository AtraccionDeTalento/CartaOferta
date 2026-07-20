// Service for organizational master catalog loading and filtering
export interface Sucursal {
  id: number;
  nombre: string;
}

export interface Departamento {
  id: number;
  nombre: string;
}

export interface Area {
  id: number;
  nombre: string;
}

export interface Unidad {
  id: number;
  nombre: string;
}

export interface Puesto {
  id: number;
  nombre: string;
}

export interface Ceco {
  codigo: string;
  descripcion: string;
}

export interface Estructura {
  id: number;
  sucursal_id: number;
  departamento_id: number;
  area_id: number | null;
  unidad_id: number;
  puesto_id: number;
  ceco_code: string | null;
  supervisor?: string | null;
}

import { buildAssetUrl } from './paths';

// In-memory cache
let sucursales: Sucursal[] = [];
let departamentos: Departamento[] = [];
let areas: Area[] = [];
let unidades: Unidad[] = [];
let puestos: Puesto[] = [];
let cecos: Record<string, string> = {}; // codigo -> descripcion
let estructura: Estructura[] = [];

let isLoaded = false;
let loadPromise: Promise<void> | null = null;

export const loadOrganizationalCatalog = (): Promise<void> => {
  if (isLoaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const fetchJson = async (name: string) => {
        const res = await fetch(buildAssetUrl(`data/normalized/${name}.json`));
        if (!res.ok) throw new Error(`Failed to load ${name}`);
        return res.json();
      };

      const [
        sucData,
        deptData,
        areaData,
        uniData,
        puestoData,
        cecoData,
        estData
      ] = await Promise.all([
        fetchJson('sucursales'),
        fetchJson('departamentos'),
        fetchJson('areas'),
        fetchJson('unidades'),
        fetchJson('puestos'),
        fetchJson('cecos'),
        fetchJson('estructura_organizacional')
      ]);

      sucursales = sucData;
      departamentos = deptData;
      areas = areaData;
      unidades = uniData;
      puestos = puestoData;
      estructura = estData;

      // Convert cecos array to lookup object
      cecos = {};
      cecoData.forEach((c: any) => {
        cecos[c.codigo] = c.descripcion;
      });

      isLoaded = true;
      console.log("Organizational catalog loaded successfully.");
    } catch (error) {
      console.error("Failed to load organizational catalogs:", error);
      // Fallback for development if fetch fails
      isLoaded = false;
      throw error;
    }
  })();

  return loadPromise;
};

// Filter APIs
export const getSucursales = async (): Promise<Sucursal[]> => {
  await loadOrganizationalCatalog();
  return sucursales;
};

export const getDepartamentos = async (sucursalId: number): Promise<Departamento[]> => {
  await loadOrganizationalCatalog();
  const deptIds = new Set(
    estructura
      .filter((e) => e.sucursal_id === sucursalId)
      .map((e) => e.departamento_id)
  );
  return departamentos.filter((d) => deptIds.has(d.id));
};

export const getAreas = async (sucursalId: number, departamentoId: number): Promise<Area[]> => {
  await loadOrganizationalCatalog();
  const areaIds = new Set(
    estructura
      .filter((e) => e.sucursal_id === sucursalId && e.departamento_id === departamentoId)
      .map((e) => e.area_id)
  );
  return areas.filter((a) => areaIds.has(a.id));
};

export const getUnidades = async (
  sucursalId: number,
  departamentoId: number,
  areaId: number | null
): Promise<Unidad[]> => {
  await loadOrganizationalCatalog();
  const uniIds = new Set(
    estructura
      .filter(
        (e) =>
          e.sucursal_id === sucursalId &&
          e.departamento_id === departamentoId &&
          e.area_id === areaId
      )
      .map((e) => e.unidad_id)
  );
  return unidades.filter((u) => uniIds.has(u.id));
};

export const getPuestos = async (
  sucursalId: number,
  departamentoId: number,
  areaId: number | null,
  unidadId: number
): Promise<Puesto[]> => {
  await loadOrganizationalCatalog();
  const puestoIds = new Set(
    estructura
      .filter(
        (e) =>
          e.sucursal_id === sucursalId &&
          e.departamento_id === departamentoId &&
          e.area_id === areaId &&
          e.unidad_id === unidadId
      )
      .map((e) => e.puesto_id)
  );
  return puestos.filter((p) => puestoIds.has(p.id));
};

export const getCecoForPuestoSelection = async (
  sucursalId: number,
  departamentoId: number,
  areaId: number | null,
  unidadId: number,
  puestoId: number
): Promise<{ code: string; description: string } | null> => {
  await loadOrganizationalCatalog();
  const match = estructura.find(
    (e) =>
      e.sucursal_id === sucursalId &&
      e.departamento_id === departamentoId &&
      e.area_id === areaId &&
      e.unidad_id === unidadId &&
      e.puesto_id === puestoId
  );
  if (match && match.ceco_code) {
    return {
      code: match.ceco_code,
      description: cecos[match.ceco_code] || "CENTRO DE COSTOS"
    };
  }
  return null;
};

export interface OrgPath {
  id: number;
  sucursal: string;
  departamento: string;
  area: string;
  unidad: string;
  puesto: string;
  cecoCode: string;
  cecoDescription: string;
  supervisor: string;
  ids: {
    sucursalId: number;
    departamentoId: number;
    areaId: number | null;
    unidadId: number;
    puestoId: number;
  };
}

export const getFullOrgPaths = async (): Promise<OrgPath[]> => {
  await loadOrganizationalCatalog();
  const sucMap = new Map(sucursales.map(s => [s.id, s.nombre]));
  const deptMap = new Map(departamentos.map(d => [d.id, d.nombre]));
  const areaMap = new Map(areas.map(a => [a.id, a.nombre]));
  const uniMap = new Map(unidades.map(u => [u.id, u.nombre]));
  const puestoMap = new Map(puestos.map(p => [p.id, p.nombre]));

  return estructura.map((e) => {
    const sucursal = sucMap.get(e.sucursal_id) || '';
    const departamento = deptMap.get(e.departamento_id) || '';
    const area = e.area_id ? (areaMap.get(e.area_id) || '') : '';
    const unidad = uniMap.get(e.unidad_id) || '';
    const puesto = puestoMap.get(e.puesto_id) || '';
    const cecoCode = e.ceco_code || '';
    const cecoDescription = cecoCode ? (cecos[cecoCode] || '') : '';
    const supervisor = e.supervisor || '';

    return {
      id: e.id,
      sucursal,
      departamento,
      area,
      unidad,
      puesto,
      cecoCode,
      cecoDescription,
      supervisor,
      ids: {
        sucursalId: e.sucursal_id,
        departamentoId: e.departamento_id,
        areaId: e.area_id,
        unidadId: e.unidad_id,
        puestoId: e.puesto_id
      }
    };
  });
};
