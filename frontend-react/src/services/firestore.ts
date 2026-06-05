import { 
  collection, 
  onSnapshot, 
  addDoc as fsAddDoc, 
  updateDoc as fsUpdateDoc, 
  deleteDoc as fsDeleteDoc, 
  doc, 
  getDocs, 
  getDoc as fsGetDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

// Helper to trigger events when local storage updates (simulating real-time updates)
const triggerLocalDbChange = (collectionName: string) => {
  window.dispatchEvent(new CustomEvent(`localdb_change_${collectionName}`));
};

// Seed LocalStorage with default data if empty
export const initLocalStorageData = () => {
  if (!localStorage.getItem('solicitudes_ingreso')) {
    const defaultSolicitudes = [
      {
        id: "sol_1",
        correlativo: 2410,
        unidad: "USIL",
        fecha_solicitud: "2026-05-20",
        fecha_tentativa_ingreso: "2026-06-01",
        modalidad: "FULL TIME",
        nombres_apellidos: "ARMANDO JUAREZ COBEÑAS",
        puesto: "ANALISTA JUNIOR DE TI",
        codigo_cr: "S11500M064",
        salario: 3500,
        salario_letras: "TRES MIL QUINIENTOS Y 00/100 SOLES",
        categoria: "ADMINISTRATIVOS",
        tipo_ingreso: "Ingreso sin Reemplazo",
        estado: "APROBADO",
        plantilla_carta: "CO BASE",
        incluye_eps: true,
        incluye_movilidad: false,
        incluye_tarjeta_alimentos: false,
        incluye_bono_transporte: false,
        periodo_prueba: "03 meses",
        jornada: "48",
        created_at: new Date("2026-05-20T10:00:00Z").toISOString()
      },
      {
        id: "sol_2",
        correlativo: 2411,
        unidad: "CSIR",
        fecha_solicitud: "2026-05-22",
        fecha_tentativa_ingreso: "2026-06-01",
        modalidad: "PRACTICANTE PRE",
        nombres_apellidos: "EDWARD ABEL DÁVILA LÓPEZ",
        puesto: "PRACTICANTE DE COMPENSACIONES",
        codigo_cr: "C11200M012",
        salario: 1025,
        salario_letras: "MIL VEINTICINCO Y 00/100 SOLES",
        categoria: "ADMINISTRATIVOS",
        tipo_ingreso: "Ingreso sin Reemplazo",
        estado: "BORRADOR",
        plantilla_carta: "PRACTICANTE PRE",
        incluye_eps: true,
        incluye_movilidad: false,
        incluye_tarjeta_alimentos: false,
        incluye_bono_transporte: false,
        periodo_prueba: "No aplica",
        jornada: "30",
        created_at: new Date("2026-05-22T11:00:00Z").toISOString()
      },
      {
        id: "sol_3",
        correlativo: 2412,
        unidad: "EPG",
        fecha_solicitud: "2026-05-24",
        fecha_tentativa_ingreso: "2026-06-15",
        modalidad: "FULL TIME",
        nombres_apellidos: "THOMAS JUNIOR HUAMÁN PIJO",
        puesto: "COORDINADOR DE ADMISION",
        codigo_cr: "E20100M001",
        salario: 5000,
        salario_letras: "CINCO MIL Y 00/100 SOLES",
        categoria: "ADMINISTRATIVOS",
        tipo_ingreso: "Ingreso sin Reemplazo",
        estado: "CARTA_EMITIDA",
        carta_id: "carta_1",
        plantilla_carta: "CO BASE",
        incluye_eps: true,
        incluye_movilidad: false,
        incluye_tarjeta_alimentos: false,
        incluye_bono_transporte: false,
        periodo_prueba: "03 meses",
        jornada: "48",
        created_at: new Date("2026-05-24T09:00:00Z").toISOString()
      }
    ];
    localStorage.setItem('solicitudes_ingreso', JSON.stringify(defaultSolicitudes));
  }

  if (!localStorage.getItem('movimientos')) {
    const defaultMovimientos = [
      {
        id: "mov_1",
        codigo_colaborador: "U00182",
        nombre: "KARLA ANDREA RIOS VILLACREZ",
        cargo_actual: "ANALISTA DE RRHH",
        tipo_documento: "Promoción",
        fecha_cambio: "2026-06-01",
        sucursal: "UNIVERSIDAD",
        cargo_nuevo: "COORDINADOR DE OPERACIONES",
        adryan: "SI",
        estado: "COMPLETADO",
        created_at: new Date("2026-05-18T10:00:00Z").toISOString()
      },
      {
        id: "mov_2",
        codigo_colaborador: "U00249",
        nombre: "BRYAM AMED OLIVARES PEREZ",
        cargo_actual: "CHOFER",
        tipo_documento: "Asignación de Movilidad",
        fecha_cambio: "2026-05-15",
        sucursal: "UNIVERSIDAD",
        cargo_nuevo: "CHOFER",
        adryan: "NO APLICA",
        estado: "PENDIENTE",
        created_at: new Date("2026-05-19T10:00:00Z").toISOString()
      }
    ];
    localStorage.setItem('movimientos', JSON.stringify(defaultMovimientos));
  }

  if (!localStorage.getItem('cartas_oferta')) {
    const defaultCartas = [
      {
        id: "carta_1",
        solicitud_id: "sol_3",
        correlativo: 2412,
        nombre_colaborador: "THOMAS JUNIOR HUAMÁN PIJO",
        puesto: "COORDINADOR DE ADMISION",
        plantilla_usada: "CO BASE",
        estado: "GENERADA",
        created_at: new Date("2026-05-24T09:30:00Z").toISOString()
      }
    ];
    localStorage.setItem('cartas_oferta', JSON.stringify(defaultCartas));
  }
};

// Generic Real-Time Subscription
export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void): (() => void) => {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, collectionName));
    return onSnapshot(q, (snapshot: any) => {
      const items: any[] = [];
      snapshot.forEach((doc: any) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      callback(items);
    }, (error: any) => {
      console.error(`Firestore subscription error on ${collectionName}:`, error);
    });
  } else {
    // Initial load
    initLocalStorageData();
    const loadLocal = () => {
      try {
        const stored = localStorage.getItem(collectionName);
        const data = stored ? JSON.parse(stored) : [];
        callback(data);
      } catch (e) {
        console.error(`Error loading local collection ${collectionName}:`, e);
        callback([]);
      }
    };
    
    window.addEventListener(`localdb_change_${collectionName}`, loadLocal);
    loadLocal();
    
    return () => {
      window.removeEventListener(`localdb_change_${collectionName}`, loadLocal);
    };
  }
};

// Add Document
export const addDoc = async (collectionName: string, data: any): Promise<string> => {
  if (isFirebaseConfigured && db) {
    const docRef = await fsAddDoc(collection(db, collectionName), {
      ...data,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } else {
    initLocalStorageData();
    const stored = localStorage.getItem(collectionName);
    const list = stored ? JSON.parse(stored) : [];
    const id = `${collectionName.substring(0, 3)}_${Date.now()}`;
    const record = { 
      id, 
      ...data,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    list.push(record);
    localStorage.setItem(collectionName, JSON.stringify(list));
    triggerLocalDbChange(collectionName);
    return id;
  }
};

// Update Document
export const updateDoc = async (collectionName: string, id: string, data: any): Promise<void> => {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, collectionName, id);
    await fsUpdateDoc(docRef, {
      ...data,
      updated_at: new Date().toISOString()
    });
  } else {
    initLocalStorageData();
    const stored = localStorage.getItem(collectionName);
    const list = stored ? JSON.parse(stored) : [];
    const index = list.findIndex((x: any) => x.id === id);
    if (index !== -1) {
      list[index] = { 
        ...list[index], 
        ...data,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(collectionName, JSON.stringify(list));
      triggerLocalDbChange(collectionName);
    } else {
      throw new Error(`Document with ID ${id} not found in ${collectionName}`);
    }
  }
};

// Delete Document
export const deleteDoc = async (collectionName: string, id: string): Promise<void> => {
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, collectionName, id);
    await fsDeleteDoc(docRef);
  } else {
    initLocalStorageData();
    const stored = localStorage.getItem(collectionName);
    const list = stored ? JSON.parse(stored) : [];
    const filtered = list.filter((x: any) => x.id !== id);
    localStorage.setItem(collectionName, JSON.stringify(filtered));
    triggerLocalDbChange(collectionName);
  }
};

// Fetch Collection (one-off)
export const getCollection = async (collectionName: string): Promise<any[]> => {
  if (isFirebaseConfigured && db) {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const items: any[] = [];
    querySnapshot.forEach((doc: any) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items;
  } else {
    initLocalStorageData();
    const stored = localStorage.getItem(collectionName);
    return stored ? JSON.parse(stored) : [];
  }
};
