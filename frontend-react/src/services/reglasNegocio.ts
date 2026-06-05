// Declarative business rules engine for letter template determination and validation
import { buildAssetUrl } from './paths';

export interface Condicion {
  field: string;
  operator?: 'equal' | 'not_equal' | 'contains' | 'true' | 'false';
  value?: any;
  any?: Condicion[];
  all?: Condicion[];
}

export interface ReglaNegocio {
  plantilla: string;
  condiciones: Condicion[];
}

export interface PlantillaConfig {
  config_defecto: {
    jornada?: string;
    incluye_eps?: boolean;
    periodo_prueba?: string;
    incluye_tarjeta_alimentos?: boolean;
    monto_tarjeta_alimentos?: number;
    incluye_bono_transporte?: boolean;
    monto_bono_transporte?: number;
  };
  variables: Record<string, string>;
  parrafos: string[];
}

let reglas: ReglaNegocio[] = [];
let plantillas: Record<string, PlantillaConfig> = {};
let isConfigLoaded = false;

export const loadBusinessRules = async (): Promise<void> => {
  if (isConfigLoaded) return;
  try {
    const [reglasRes, plantillasRes] = await Promise.all([
      fetch(buildAssetUrl('data/config/rules_config.json')),
      fetch(buildAssetUrl('data/config/templates_config.json'))
    ]);

    if (reglasRes.ok) reglas = await reglasRes.json();
    if (plantillasRes.ok) plantillas = await plantillasRes.json();
    isConfigLoaded = true;
  } catch (error) {
    console.warn("Could not load rules from API, using fallback rules.", error);
    // Load some basic fallback configuration
    reglas = [];
    plantillas = {};
    isConfigLoaded = false;
  }
};

const evaluarCondicion = (cond: Condicion, solicitud: any): boolean => {
  if (cond.any) {
    return cond.any.some((c) => evaluarCondicion(c, solicitud));
  }
  if (cond.all) {
    return cond.all.every((c) => evaluarCondicion(c, solicitud));
  }

  const { field, operator = 'equal', value: targetVal } = cond;
  const rawVal = solicitud[field];
  
  const valStr = String(rawVal ?? '').toUpperCase().trim();
  const targetStr = String(targetVal ?? '').toUpperCase().trim();

  switch (operator) {
    case 'contains':
      return valStr.includes(targetStr);
    case 'equal':
      return valStr === targetStr;
    case 'not_equal':
      return valStr !== targetStr;
    case 'true':
      return !!rawVal === true;
    case 'false':
      return !!rawVal === false;
    default:
      return false;
  }
};

export const determinarPlantillaCliente = async (solicitud: any): Promise<string> => {
  await loadBusinessRules();
  
  if (reglas.length === 0) {
    return determinarPlantillaFallback(solicitud);
  }

  for (const rule of reglas) {
    const condiciones = rule.condiciones || [];
    if (condiciones.length === 0 || condiciones.every(c => evaluarCondicion(c, solicitud))) {
      return rule.plantilla;
    }
  }

  return "CO BASE";
};

// Fallback logic matching backend/services/reglas_negocio.py
const determinarPlantillaFallback = (solicitud: any): string => {
  const modalidad = String(solicitud.modalidad || '').toUpperCase().trim();
  const tipoIngreso = String(solicitud.tipo_ingreso || '').toUpperCase().trim();
  const unidad = String(solicitud.unidad || '').toUpperCase().trim();
  const incluyeEps = solicitud.incluye_eps !== false;
  const incluyeMovilidad = !!solicitud.incluye_movilidad;
  const incluyeTarjeta = !!solicitud.incluye_tarjeta_alimentos;
  const incluyeTransporte = !!solicitud.incluye_bono_transporte;
  const tipoPersonal = String(solicitud.tipo_personal || '').toUpperCase().trim();
  const jornada = String(solicitud.jornada || '48');
  const puesto = String(solicitud.puesto || '').toUpperCase().trim();
  const categoriaTrab = String(solicitud.categoria_trabajador || '').toUpperCase().trim();

  if (modalidad.includes('PRACTICANTE') || puesto.includes('PRACTICANTE') || tipoIngreso.includes('PRACTICANTE')) {
    if (modalidad.includes('PRE') || puesto.includes('PRE')) {
      return "PRACTICANTE PRE";
    }
    return "PRACTICANTE PRO";
  }

  if (tipoIngreso.includes('MATERNIDAD') || tipoIngreso.includes('LICENCIA')) {
    return "CO maternidad";
  }

  if (puesto.includes('PREPARADOR') || puesto.includes('INSTRUCTOR')) {
    return "PREPARADOR FISICO";
  }

  if (puesto.includes('OPERADOR') && puesto.includes('PROMOTOR')) {
    return "operador";
  }

  if (unidad === 'GEF' || unidad === 'IE') return "CO GEF";
  if (unidad === 'CSIR') return "CSIR";

  if (modalidad.includes('PART') || jornada !== '48') {
    return incluyeEps ? "PART TIME" : "PART TIME (2)";
  }

  if (puesto.includes('CHOFER')) return "CO Chofer";

  if ((incluyeMovilidad && incluyeTarjeta) || (incluyeTransporte && incluyeTarjeta)) {
    return "CO+mov+teb";
  }

  if (!incluyeEps) return "CO sin eps";

  if (puesto.includes('DOCENTE') && modalidad.includes('TIEMPO PARCIAL')) {
    return "CO TP";
  }

  if (puesto.includes('GERENTE') || tipoPersonal.includes('INDETERMINADO')) {
    return "CO X";
  }

  if (tipoPersonal.includes('DIRECCION') && categoriaTrab.includes('NO FISCALIZABLE')) {
    return "CO (3)";
  }

  if (tipoPersonal.includes('CONFIANZA') && categoriaTrab.includes('NO FISCALIZABLE')) {
    return "CO BASE (2)";
  }

  if (categoriaTrab.includes('SUJETO')) {
    return "CO BASE (3)";
  }

  return "CO BASE";
};

export const getTemplateDetails = async (nombre: string): Promise<PlantillaConfig | null> => {
  await loadBusinessRules();
  return plantillas[nombre] || null;
};
