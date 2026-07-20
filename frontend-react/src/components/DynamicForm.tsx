import React, { useState, useEffect } from 'react';
import { SearchSelect } from './SearchSelect';
import { determinarPlantillaCliente } from '../services/reglasNegocio';
import { TIPOS_CARTA, getCartaTemplateMeta } from '../services/cartas';
import { 
  getSucursales, 
  getDepartamentos, 
  getAreas, 
  getUnidades, 
  getPuestos, 
  getCecoForPuestoSelection,
  Sucursal,
  Departamento,
  Area,
  Unidad,
  Puesto,
  getFullOrgPaths,
  OrgPath
} from '../services/catalogos';
import { AlertCircle, FileUp, Link2, Save, Sparkles, Loader2, CheckCircle2, Search } from 'lucide-react';
import { extractCandidateData, isGeminiConfigured } from '../services/gemini';
import { extractTextFromPdf, fileToBase64 } from '../services/pdfText';

interface DynamicFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  initialData,
  onSubmit,
  onCancel
}) => {
  // Form values
  const [nombres, setNombres] = useState(initialData?.nombres_apellidos || '');
  const [dni, setDni] = useState(initialData?.dni || '');
  const [tipoIngreso, setTipoIngreso] = useState(initialData?.tipo_ingreso || 'Ingreso sin Reemplazo');
  
  // Conditional Replacement fields
  const [codigoReemplazo, setCodigoReemplazo] = useState(initialData?.codigo_reemplazo || '');
  const [nombreReemplazo, setNombreReemplazo] = useState(initialData?.nombre_reemplazo || '');

  // Hierarchical Select states
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [selectedSucursal, setSelectedSucursal] = useState<number | null>(null);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [selectedDepartamento, setSelectedDepartamento] = useState<number | null>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);

  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [selectedUnidad, setSelectedUnidad] = useState<number | null>(null);

  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [selectedPuesto, setSelectedPuesto] = useState<number | null>(null);

  // Auto-completed fields
  const [codigoCr, setCodigoCr] = useState(initialData?.codigo_cr || '');
  const [cecoDesc, setCecoDesc] = useState('');

  // Other form fields
  const [salario, setSalario] = useState<number>(initialData?.salario || 0);
  const [modalidad, setModalidad] = useState(initialData?.modalidad || 'FULL TIME');
  const [tipoPersonal, setTipoPersonal] = useState(initialData?.tipo_personal || 'EMPLEADO');
  const [categoriaTrabajador, setCategoriaTrabajador] = useState(initialData?.categoria_trabajador || 'SUJETO A FISCALIZACION');
  const [periodoPrueba, setPeriodoPrueba] = useState(initialData?.periodo_prueba || '03 meses');
  const [jornada, setJornada] = useState(initialData?.jornada || '48');
  const [tiempoContrato, setTiempoContrato] = useState(initialData?.tiempo_contrato || '6 meses');
  const [nombreJefe, setNombreJefe] = useState(initialData?.nombre_jefe_directo || '');
  const [fechaTentativa, setFechaTentativa] = useState(initialData?.fecha_tentativa_ingreso || '');
  const [fechaTermino, setFechaTermino] = useState(initialData?.fecha_termino_contrato || '');

  // Benefits
  const [incluyeEps, setIncluyeEps] = useState<boolean>(initialData?.incluye_eps !== false);
  const [incluyeMovilidad, setIncluyeMovilidad] = useState<boolean>(!!initialData?.incluye_movilidad);
  const [montoMovilidad, setMontoMovilidad] = useState<number>(initialData?.monto_movilidad || 0);
  const [incluyeTarjetaAlimentos, setIncluyeTarjetaAlimentos] = useState<boolean>(!!initialData?.incluye_tarjeta_alimentos);
  const [montoTarjetaAlimentos, setMontoTarjetaAlimentos] = useState<number>(initialData?.monto_tarjeta_alimentos || 0);
  const [incluyeBonoTransporte, setIncluyeBonoTransporte] = useState<boolean>(!!initialData?.incluye_bono_transporte);
  const [montoBonoTransporte, setMontoBonoTransporte] = useState<number>(initialData?.monto_bono_transporte || 0);
  const [plantillaCarta, setPlantillaCarta] = useState<string>(initialData?.plantilla_carta || 'CO BASE');
  const [plantillaManual, setPlantillaManual] = useState<boolean>(!!initialData?.plantilla_carta);
  const [templateSearch, setTemplateSearch] = useState('');
  const [fuenteCandidaturaUrl, setFuenteCandidaturaUrl] = useState(initialData?.fuente_candidatura_url || '');
  const [resumenCandidato, setResumenCandidato] = useState(initialData?.resumen_candidato || '');
  const [archivosReferencia, setArchivosReferencia] = useState<Array<{ nombre: string; tipo: string; tamanoKb: number }>>(
    Array.isArray(initialData?.archivos_referencia) ? initialData.archivos_referencia : []
  );
  // Archivos reales solo en memoria del navegador — se usan para leer texto/imagen y luego se descartan.
  const [archivosFiles, setArchivosFiles] = useState<File[]>([]);
  const [iaState, setIaState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [iaMessage, setIaMessage] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local BM25/TF-IDF positional search engine states
  const [allPaths, setAllPaths] = useState<OrgPath[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OrgPath[]>([]);
  const [pendingPathSelection, setPendingPathSelection] = useState<any | null>(null);

  const buildSubmissionData = (isQuickDraft = false) => {
    const sucObj = sucursales.find(s => s.id === selectedSucursal);
    const deptObj = departamentos.find(d => d.id === selectedDepartamento);
    const areaObj = areas.find(a => a.id === selectedArea);
    const uniObj = unidades.find(u => u.id === selectedUnidad);
    const puestoObj = puestos.find(p => p.id === selectedPuesto);
    const fechaBase = new Date().toISOString().slice(0, 10);

    return {
      nombres_apellidos: (nombres || (isQuickDraft ? 'POR DEFINIR' : '')).toUpperCase().trim(),
      dni: (dni.trim() || (isQuickDraft ? 'PENDIENTE' : '')),
      tipo_ingreso: tipoIngreso,
      codigo_reemplazo: tipoIngreso.includes('Reemplazo') ? codigoReemplazo.toUpperCase().trim() : '',
      nombre_reemplazo: tipoIngreso.includes('Reemplazo') ? nombreReemplazo.toUpperCase().trim() : '',
      sucursal: sucObj?.nombre || (isQuickDraft ? 'POR DEFINIR' : ''),
      departamento: deptObj?.nombre || (isQuickDraft ? 'POR DEFINIR' : ''),
      area: areaObj?.nombre || '',
      unidad: uniObj?.nombre || (isQuickDraft ? 'POR DEFINIR' : ''),
      puesto: puestoObj?.nombre || (isQuickDraft ? 'POR DEFINIR' : ''),
      codigo_cr: codigoCr.toUpperCase().trim() || (isQuickDraft ? 'PENDIENTE' : ''),
      salario: Number(salario) || 0,
      modalidad: modalidad,
      tipo_personal: tipoPersonal,
      categoria_trabajador: categoriaTrabajador,
      periodo_prueba: periodoPrueba,
      jornada: jornada,
      tiempo_contrato: tiempoContrato,
      nombre_jefe_directo: (nombreJefe || (isQuickDraft ? 'POR DEFINIR' : '')).toUpperCase().trim(),
      fecha_tentativa_ingreso: fechaTentativa || (isQuickDraft ? fechaBase : ''),
      fecha_termino_contrato: fechaTermino || null,
      incluye_eps: incluyeEps,
      incluye_movilidad: incluyeMovilidad,
      monto_movilidad: incluyeMovilidad ? Number(montoMovilidad) : 0,
      incluye_tarjeta_alimentos: incluyeTarjetaAlimentos,
      monto_tarjeta_alimentos: incluyeTarjetaAlimentos ? Number(montoTarjetaAlimentos) : 0,
      incluye_bono_transporte: incluyeBonoTransporte,
      monto_bono_transporte: incluyeBonoTransporte ? Number(montoBonoTransporte) : 0,
      plantilla_carta: plantillaCarta,
      fuente_candidatura_url: fuenteCandidaturaUrl.trim(),
      resumen_candidato: resumenCandidato.trim(),
      archivos_referencia: archivosReferencia,
      captura_rapida: isQuickDraft,
    };
  };

  const handleReferenceFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setArchivosFiles(files);
    setArchivosReferencia(
      files.map((file) => ({
        nombre: file.name,
        tipo: file.type || 'application/octet-stream',
        tamanoKb: Math.round(file.size / 1024),
      }))
    );
    setIaState('idle');
    setIaMessage('');
  };

  const handleOrganizarConIA = async () => {
    console.log("IA Analysis triggered. Text length:", resumenCandidato.trim().length, "Files count:", archivosFiles.length);
    if (!resumenCandidato.trim() && archivosFiles.length === 0) {
      setIaState('error');
      setIaMessage('Pega un resumen o adjunta al menos un archivo (CV en PDF, texto o imagen) para que la IA tenga algo que leer.');
      return;
    }

    setIaState('loading');
    setIaMessage('');

    try {
      let combinedText = resumenCandidato.trim();
      const archivosInline: Array<{ data: string; mimeType: string }> = [];
      const omitidos: string[] = [];

      for (const file of archivosFiles) {
        console.log("Processing file:", file.name, "MIME:", file.type, "Size:", file.size);
        if (file.type === 'application/pdf') {
          console.log("Reading PDF as Base64 for direct Gemini multimodal OCR parsing:", file.name);
          const base64 = await fileToBase64(file);
          archivosInline.push({ data: base64, mimeType: file.type });
        } else if (file.type.startsWith('image/')) {
          console.log("Converting image to Base64:", file.name);
          const base64 = await fileToBase64(file);
          archivosInline.push({ data: base64, mimeType: file.type });
        } else if (file.type === 'text/plain') {
          console.log("Reading plain text file:", file.name);
          combinedText += `\n\n--- Contenido de ${file.name} ---\n${await file.text()}`;
        } else {
          console.log("Skipping unsupported file type:", file.name);
          omitidos.push(file.name);
        }
      }

      console.log("Sending candidate extraction request to Gemini. Inline files count:", archivosInline.length, "Text length:", combinedText.length);
      const extracted = await extractCandidateData({ texto: combinedText, archivos: archivosInline });
      console.log("Extracted data received from Gemini:", extracted);

      if (extracted.nombres_apellidos) setNombres(extracted.nombres_apellidos);
      if (extracted.dni) setDni(extracted.dni);
      if (extracted.salario) setSalario(extracted.salario);
      if (extracted.modalidad) setModalidad(extracted.modalidad);
      if (extracted.tiempo_contrato) setTiempoContrato(extracted.tiempo_contrato);
      if (extracted.nombre_jefe_directo) setNombreJefe(extracted.nombre_jefe_directo);
      if (extracted.fecha_tentativa_ingreso) setFechaTentativa(extracted.fecha_tentativa_ingreso);
      if (extracted.puesto_sugerido || extracted.observaciones) {
        const nota = [
          extracted.puesto_sugerido ? `Puesto sugerido por IA: ${extracted.puesto_sugerido}` : '',
          extracted.observaciones || '',
        ].filter(Boolean).join('. ');
        if (nota) setResumenCandidato((prev: string) => (prev ? `${prev}\n\n${nota}` : nota));
      }

      setIaState('success');
      setIaMessage(
        omitidos.length > 0
          ? `Datos organizados. No se pudieron leer estos archivos (formato no soportado): ${omitidos.join(', ')}.`
          : 'Datos organizados. Revisa los campos autocompletados antes de guardar.'
      );
    } catch (err: any) {
      console.error("Error in IA candidate organization:", err);
      setIaState('error');
      setIaMessage(err?.message || 'No se pudo procesar con IA.');
    }
  };

  // Load full catalog paths for search matching
  useEffect(() => {
    const fetchPaths = async () => {
      try {
        const paths = await getFullOrgPaths();
        setAllPaths(paths);
      } catch (err) {
        console.error("Error loading full org paths for search assistant:", err);
      }
    };
    fetchPaths();
  }, []);

  // Run local search query using term weighting (BM25/TF-IDF approximation)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const queryTerms = searchQuery
      .toLowerCase()
      .split(/[\s,.\-_/()]+/)
      .filter(t => t.length > 2);

    if (queryTerms.length === 0) {
      setSearchResults([]);
      return;
    }

    const scored = allPaths.map(path => {
      let score = 0;
      const termsInPuesto = path.puesto.toLowerCase();
      const termsInUnidad = path.unidad.toLowerCase();
      const termsInDept = path.departamento.toLowerCase();
      const termsInArea = path.area.toLowerCase();
      const termsInCeco = path.cecoCode.toLowerCase();
      const termsInCecoDesc = path.cecoDescription.toLowerCase();

      queryTerms.forEach(term => {
        // Puesto match is highest weight
        if (termsInPuesto.includes(term)) {
          score += termsInPuesto === term ? 12 : (termsInPuesto.startsWith(term) ? 8 : 4);
        }
        // Unidad match
        if (termsInUnidad.includes(term)) {
          score += termsInUnidad === term ? 6 : 3;
        }
        // Dept match
        if (termsInDept.includes(term)) {
          score += termsInDept === term ? 4 : 2;
        }
        // Area match
        if (termsInArea.includes(term)) {
          score += termsInArea === term ? 4 : 2;
        }
        // CECO code exact match
        if (termsInCeco === term) {
          score += 10;
        }
        // CECO description match
        if (termsInCecoDesc.includes(term)) {
          score += 3;
        }
      });

      return { path, score };
    });

    const sorted = scored
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.path);

    setSearchResults(sorted);
  }, [searchQuery, allPaths]);

  // 1. Initial Load of Sucursales
  useEffect(() => {
    const fetchSuc = async () => {
      const list = await getSucursales();
      setSucursales(list);

      // If editing, map initial strings to IDs if possible, or wait
      if (initialData?.sucursal) {
        const found = list.find(s => s.nombre === initialData.sucursal);
        if (found) setSelectedSucursal(found.id);
      }
    };
    fetchSuc();
  }, [initialData]);

  // 2. Load Departamentos on Sucursal Change
  useEffect(() => {
    if (selectedSucursal) {
      const fetchDept = async () => {
        const list = await getDepartamentos(selectedSucursal);
        setDepartamentos(list);
        if (pendingPathSelection) {
          setSelectedDepartamento(pendingPathSelection.departamentoId);
        } else if (initialData?.departamento && !selectedDepartamento) {
          const found = list.find(d => d.nombre === initialData.departamento);
          if (found) setSelectedDepartamento(found.id);
        }
      };
      fetchDept();
    } else {
      setDepartamentos([]);
      setSelectedDepartamento(null);
    }
    // Reset lower dependencies
    if (!pendingPathSelection) {
      setSelectedArea(null);
      setSelectedUnidad(null);
      setSelectedPuesto(null);
    }
  }, [selectedSucursal]);

  // 3. Load Áreas on Departamento Change
  useEffect(() => {
    if (selectedSucursal && selectedDepartamento) {
      const fetchAreas = async () => {
        const list = await getAreas(selectedSucursal, selectedDepartamento);
        setAreas(list);
        if (pendingPathSelection) {
          setSelectedArea(pendingPathSelection.areaId);
        } else if (initialData?.area && !selectedArea) {
          const found = list.find(a => a.nombre === initialData.area);
          if (found) setSelectedArea(found.id);
        }
      };
      fetchAreas();
    } else {
      setAreas([]);
      setSelectedArea(null);
    }
    if (!pendingPathSelection) {
      setSelectedUnidad(null);
      setSelectedPuesto(null);
    }
  }, [selectedDepartamento]);

  // 4. Load Unidades on Area Selection
  useEffect(() => {
    if (selectedSucursal && selectedDepartamento) {
      const fetchUni = async () => {
        const list = await getUnidades(selectedSucursal, selectedDepartamento, selectedArea);
        setUnidades(list);
        if (pendingPathSelection) {
          setSelectedUnidad(pendingPathSelection.unidadId);
        } else if (initialData?.unidad && !selectedUnidad) {
          const found = list.find(u => u.nombre === initialData.unidad);
          if (found) setSelectedUnidad(found.id);
        }
      };
      fetchUni();
    } else {
      setUnidades([]);
      setSelectedUnidad(null);
    }
    if (!pendingPathSelection) {
      setSelectedPuesto(null);
    }
  }, [selectedArea, selectedDepartamento]);

  // 5. Load Puestos on Unidad Selection
  useEffect(() => {
    if (selectedSucursal && selectedDepartamento && selectedUnidad) {
      const fetchPuestos = async () => {
        const list = await getPuestos(selectedSucursal, selectedDepartamento, selectedArea, selectedUnidad);
        setPuestos(list);
        if (pendingPathSelection) {
          setSelectedPuesto(pendingPathSelection.puestoId);
          // Auto-selection cascade complete! Clear pending selection.
          setPendingPathSelection(null);
        } else if (initialData?.puesto && !selectedPuesto) {
          const found = list.find(p => p.nombre === initialData.puesto);
          if (found) setSelectedPuesto(found.id);
        }
      };
      fetchPuestos();
    } else {
      setPuestos([]);
      setSelectedPuesto(null);
    }
  }, [selectedUnidad]);

  // 6. Auto-complete CECO code on Puesto selection
  useEffect(() => {
    if (selectedSucursal && selectedDepartamento && selectedUnidad && selectedPuesto) {
      const autoCeco = async () => {
        const cecoInfo = await getCecoForPuestoSelection(
          selectedSucursal,
          selectedDepartamento,
          selectedArea,
          selectedUnidad,
          selectedPuesto
        );
        if (cecoInfo) {
          setCodigoCr(cecoInfo.code);
          setCecoDesc(cecoInfo.description);
        }
      };
      autoCeco();
    } else {
      // If we cleared it, keep what's input or reset
      if (!initialData) {
        setCodigoCr('');
        setCecoDesc('');
      }
    }
  }, [selectedPuesto]);

  useEffect(() => {
    if (plantillaManual) return;

    const resolveTemplate = async () => {
      const sucObj = sucursales.find(s => s.id === selectedSucursal);
      const uniObj = unidades.find(u => u.id === selectedUnidad);
      const puestoObj = puestos.find(p => p.id === selectedPuesto);

      const autoTemplate = await determinarPlantillaCliente({
        modalidad,
        puesto: puestoObj?.nombre || initialData?.puesto || '',
        tipo_ingreso: tipoIngreso,
        unidad: uniObj?.nombre || sucObj?.nombre || initialData?.unidad || '',
        incluye_eps: incluyeEps,
        incluye_movilidad: incluyeMovilidad,
        incluye_tarjeta_alimentos: incluyeTarjetaAlimentos,
        incluye_bono_transporte: incluyeBonoTransporte,
        tipo_personal: tipoPersonal,
        jornada,
        categoria_trabajador: categoriaTrabajador,
      });

      setPlantillaCarta(autoTemplate);
    };

    resolveTemplate();
  }, [
    modalidad,
    tipoIngreso,
    incluyeEps,
    incluyeMovilidad,
    incluyeTarjetaAlimentos,
    incluyeBonoTransporte,
    tipoPersonal,
    jornada,
    categoriaTrabajador,
    sucursales,
    unidades,
    puestos,
    selectedSucursal,
    selectedUnidad,
    selectedPuesto,
    plantillaManual,
    initialData,
  ]);

  const filteredTemplates = TIPOS_CARTA.filter((item) => {
    const haystack = `${item.label} ${item.desc}`.toLowerCase();
    return haystack.includes(templateSearch.toLowerCase());
  });

  const templateMeta = getCartaTemplateMeta(plantillaCarta);

  // Validation logic (Poka-Yoke)
  const validateForm = (): boolean => {
    const err: Record<string, string> = {};

    if (!nombres.trim()) err.nombres = "El nombre del colaborador es obligatorio.";
    
    // DNI / CEX checks
    const dniClean = dni.trim();
    if (!dniClean) {
      err.dni = "El DNI/CEX es obligatorio.";
    } else if (!/^\d+$/.test(dniClean)) {
      err.dni = "El DNI/CEX debe contener únicamente números.";
    } else if (dniClean.length !== 8 && (dniClean.length < 9 || dniClean.length > 12)) {
      err.dni = "El DNI debe tener 8 dígitos, o Carnet de Extranjería (CEX) entre 9 y 12 dígitos.";
    }

    // Replacement condition checks
    if (tipoIngreso.includes("Reemplazo")) {
      if (!codigoReemplazo.trim()) err.codigoReemplazo = "Código del colaborador saliente es obligatorio.";
      if (!nombreReemplazo.trim()) err.nombreReemplazo = "Nombre del colaborador saliente es obligatorio.";
    }

    // Dropdown picks
    if (!selectedSucursal) err.sucursal = "Debe seleccionar una sucursal.";
    if (!selectedDepartamento) err.departamento = "Debe seleccionar un departamento.";
    if (!selectedUnidad) err.unidad = "Debe seleccionar una unidad.";
    if (!selectedPuesto) err.puesto = "Debe seleccionar un puesto.";

    // CR/CECO check
    if (!codigoCr.trim()) err.codigoCr = "Código CECO/CR es obligatorio.";

    // Salary check
    if (salario <= 0) {
      err.salario = "El salario debe ser mayor que cero.";
    } else if (modalidad.includes("PRACTICANTE") && salario > 2500) {
      err.salario = "Alerta: El salario para practicantes normalmente no excede de S/ 2,500.";
    }

    if (!fechaTentativa) err.fechaTentativa = "La fecha tentativa de ingreso es obligatoria.";
    if (!nombreJefe.trim()) err.nombreJefe = "El nombre del jefe directo es obligatorio.";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(buildSubmissionData());
    }
  };

  const handleQuickDraftSubmit = () => {
    if (!nombres.trim() && !fuenteCandidaturaUrl.trim() && !resumenCandidato.trim() && archivosReferencia.length === 0) {
      setErrors({
        quickDraft: 'Para crear un borrador rapido ingresa al menos un nombre, enlace, resumen o archivo de referencia.'
      });
      return;
    }

    setErrors({});
    onSubmit(buildSubmissionData(true));
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6.5">
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3.5 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Errores de Validación (Poka-Yoke):</span>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              {Object.values(errors).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-usil-blue-100 bg-gradient-to-br from-usil-blue-50 via-white to-slate-50 p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-usil-blue-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-usil-blue-900">Carga rapida desde briefing</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
              Pega aqui el link del candidato, el resumen del perfil y adjunta CV/PDFs. El sistema guardara un borrador rapido para completar despues sin llenar todo el formulario.
            </p>
          </div>
          <div className="rounded-full border border-usil-blue-200 bg-white px-3 py-1 text-[11px] font-bold text-usil-blue-700">
            Flujo rapido
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Link2 className="h-3.5 w-3.5 text-usil-blue-600" />
                Link del perfil o carpeta
              </label>
              <input
                type="url"
                value={fuenteCandidaturaUrl}
                onChange={(e) => setFuenteCandidaturaUrl(e.target.value)}
                placeholder="Ej: LinkedIn, Drive, folder con evidencias..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Resumen, condiciones o texto del requerimiento
              </label>
              <textarea
                value={resumenCandidato}
                onChange={(e) => setResumenCandidato(e.target.value)}
                rows={6}
                placeholder="Pega aqui el brief del BP: nombre, banda salarial, fecha tentativa, modalidad, beneficios, observaciones..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-700 outline-none transition-all duration-200 focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-usil-blue-200 bg-white/80 p-4">
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <FileUp className="h-3.5 w-3.5 text-usil-blue-600" />
                CV, PDF y archivos de referencia
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                onChange={handleReferenceFilesChange}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-usil-blue-600 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-usil-blue-700"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Por ahora se guardan como referencia del borrador. Asi reduces captura manual y luego completas solo lo faltante.
              </p>
            </div>

            {archivosReferencia.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Archivos cargados</p>
                <div className="mt-3 space-y-2">
                  {archivosReferencia.map((file, index) => (
                    <div key={`${file.nombre}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">{file.nombre}</span>
                      <span>{file.tamanoKb} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isGeminiConfigured ? (
              <button
                type="button"
                onClick={handleOrganizarConIA}
                disabled={iaState === 'loading'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-usil-blue-600 to-usil-sky-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-70"
              >
                {iaState === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Organizando con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Organizar con IA</span>
                  </>
                )}
              </button>
            ) : (
              <p className="text-[11px] font-medium text-slate-400 italic">
                Auto-organización con IA no disponible en este entorno (falta configurar la key de Gemini).
              </p>
            )}

            {iaState === 'success' && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{iaMessage}</span>
              </div>
            )}
            {iaState === 'error' && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{iaMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleQuickDraftSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-usil-blue-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-usil-blue-800 active:scale-[0.99]"
            >
              <Save className="h-4 w-4" />
              <span>Guardar borrador rapido con briefing</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sección 1: Datos del Colaborador ── */}
      <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2 mb-3">
          1. Datos Personales y Tipo de Solicitud
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Nombres y Apellidos <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              placeholder="Ej: JUAN PEREZ ALVARADO"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              DNI o Carnet Extranjería (CEX) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 72839482 o 000928392"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Tipo de Ingreso <span className="text-red-500">*</span>
            </label>
            <select
              value={tipoIngreso}
              onChange={(e) => setTipoIngreso(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            >
              <option value="Ingreso sin Reemplazo">Ingreso sin Reemplazo (Nuevo Puesto)</option>
              <option value="Ingreso por Reemplazo">Ingreso por Reemplazo (Sustitución)</option>
            </select>
          </div>
        </div>

        {/* Conditional Replacement Fields */}
        {tipoIngreso.includes("Reemplazo") && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4.5 bg-amber-50/50 border border-amber-100 rounded-lg animate-slide-in">
            <div>
              <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1.5">
                Código Colaborador Saliente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={codigoReemplazo}
                onChange={(e) => setCodigoReemplazo(e.target.value)}
                placeholder="Ej: U00123"
                className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1.5">
                Nombre Colaborador Saliente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nombreReemplazo}
                onChange={(e) => setNombreReemplazo(e.target.value)}
                placeholder="Ej: CARLOS DIAZ MEZA"
                className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
              />
            </div>
          </div>
        )}
      </div>

      {/* 🔍 Asistente de Búsqueda Predictiva de Puestos */}
      <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            🔍 Asistente de Búsqueda Predictiva de Puestos (Opcional)
          </h3>
          <span className="text-[10px] bg-usil-blue-50 text-usil-blue-700 font-bold px-2 py-0.5 rounded border border-usil-blue-100 uppercase tracking-wider">
            Rankeo Local BM25/TF-IDF
          </span>
        </div>
        <p className="text-xs text-slate-400 font-medium">
          Escribe palabras clave o el contexto del requerimiento para buscar y auto-seleccionar la estructura organizacional completa y su CECO al instante.
        </p>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ej: analista compensaciones y presupuesto lima o escribe el brief del puesto..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700 font-medium"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 border border-slate-100 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100 animate-slide-in">
            <div className="bg-slate-50 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Resultados de Búsqueda Predictiva ({searchResults.length})
            </div>
            {searchResults.map((res) => (
              <div key={res.id} className="p-4 hover:bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-usil-blue-900 flex items-center gap-2">
                    <span>{res.puesto}</span>
                    <span className="text-[9px] font-bold bg-usil-blue-50 border border-usil-blue-100 text-usil-blue-700 px-2 py-0.5 rounded font-mono">
                      CECO: {res.cecoCode}
                    </span>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400 leading-normal">
                    {res.sucursal} · {res.departamento} {res.area ? `· ${res.area}` : ''} · {res.unidad}
                    {res.cecoDescription && <span className="block text-slate-500 mt-0.5 italic">Descripción CECO: {res.cecoDescription}</span>}
                    {res.supervisor && <span className="block text-usil-blue-700 mt-0.5 font-semibold">Jefe Directo: {res.supervisor}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingPathSelection({
                      sucursalId: res.ids.sucursalId,
                      departamentoId: res.ids.departamentoId,
                      areaId: res.ids.areaId,
                      unidadId: res.ids.unidadId,
                      puestoId: res.ids.puestoId
                    });
                    // Auto-fill supervisor name
                    if (res.supervisor) {
                      setNombreJefe(res.supervisor);
                    }
                    // Set top-level state to trigger cascade
                    setSelectedSucursal(res.ids.sucursalId);
                    // Clear query to reset results
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 bg-usil-blue-50 hover:bg-usil-blue-100 text-usil-blue-700 rounded-lg text-xs font-bold transition-all border border-usil-blue-100 self-start md:self-auto"
                >
                  Auto-seleccionar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sección 2: Estructura Organizacional ── */}
      <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2 mb-3">
          2. Estructura Organizacional (Dependiente)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchSelect
            label="Sucursal / Sede"
            options={sucursales.map(s => ({ value: s.id, label: s.nombre }))}
            value={selectedSucursal}
            onChange={(val) => setSelectedSucursal(val ? Number(val) : null)}
            placeholder="Seleccione Sucursal"
            required
          />

          <SearchSelect
            label="Departamento"
            options={departamentos.map(d => ({ value: d.id, label: d.nombre }))}
            value={selectedDepartamento}
            onChange={(val) => setSelectedDepartamento(val ? Number(val) : null)}
            placeholder={selectedSucursal ? "Seleccione Departamento" : "Seleccione sucursal primero"}
            disabled={!selectedSucursal}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchSelect
            label="Área (Opcional)"
            options={areas.map(a => ({ value: a.id, label: a.nombre }))}
            value={selectedArea}
            onChange={(val) => setSelectedArea(val ? Number(val) : null)}
            placeholder={selectedDepartamento ? "Seleccione Área" : "Seleccione departamento primero"}
            disabled={!selectedDepartamento}
          />

          <SearchSelect
            label="Unidad"
            options={unidades.map(u => ({ value: u.id, label: u.nombre }))}
            value={selectedUnidad}
            onChange={(val) => setSelectedUnidad(val ? Number(val) : null)}
            placeholder={selectedDepartamento ? "Seleccione Unidad" : "Seleccione área/departamento primero"}
            disabled={!selectedDepartamento}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchSelect
            label="Puesto / Cargo"
            options={puestos.map(p => ({ value: p.id, label: p.nombre }))}
            value={selectedPuesto}
            onChange={(val) => setSelectedPuesto(val ? Number(val) : null)}
            placeholder={selectedUnidad ? "Seleccione Puesto" : "Seleccione unidad primero"}
            disabled={!selectedUnidad}
            required
          />

          {/* Autocompleted CECO */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Código Centro Costo (CR/CECO) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={codigoCr}
                onChange={(e) => setCodigoCr(e.target.value)}
                placeholder="Autocompletado desde puesto..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold focus:bg-white focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200"
              />
              {cecoDesc && (
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] bg-usil-blue-50 text-usil-blue-700 font-bold px-2 py-0.5 rounded border border-usil-blue-100 max-w-[200px] truncate">
                  {cecoDesc}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sección 3: Contrato, Salario y Beneficios ── */}
      <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-2 mb-3">
          3. Condiciones del Contrato y Salario
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Salario Mensual (S/) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={salario || ''}
              onChange={(e) => setSalario(Number(e.target.value))}
              placeholder="Ej: 3500"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Modalidad Contrato <span className="text-red-500">*</span>
            </label>
            <select
              value={modalidad}
              onChange={(e) => {
                setModalidad(e.target.value);
                if (e.target.value.includes("PRACTICANTE")) {
                  setPeriodoPrueba("No aplica");
                  setJornada("30");
                } else {
                  setPeriodoPrueba("03 meses");
                  setJornada("48");
                }
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            >
              <option value="FULL TIME">FULL TIME</option>
              <option value="PART TIME">PART TIME</option>
              <option value="PRACTICANTE PRE">PRACTICANTE PRE</option>
              <option value="PRACTICANTE PRO">PRACTICANTE PRO</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Tiempo de Contrato <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={tiempoContrato}
              onChange={(e) => setTiempoContrato(e.target.value)}
              placeholder="Ej: 6 meses"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Tipo Personal <span className="text-red-500">*</span>
            </label>
            <select
              value={tipoPersonal}
              onChange={(e) => setTipoPersonal(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            >
              <option value="EMPLEADO">EMPLEADO</option>
              <option value="CONFIANZA">CONFIANZA</option>
              <option value="DIRECCION">DIRECCION</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Categoría Trabajador <span className="text-red-500">*</span>
            </label>
            <select
              value={categoriaTrabajador}
              onChange={(e) => setCategoriaTrabajador(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            >
              <option value="SUJETO A FISCALIZACION">SUJETO A FISCALIZACION</option>
              <option value="NO SUJETO A FISCALIZACION">NO SUJETO A FISCALIZACION</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Periodo de Prueba <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={periodoPrueba}
              onChange={(e) => setPeriodoPrueba(e.target.value)}
              placeholder="Ej: 03 meses"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Jornada Semanal (Horas) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={jornada}
              onChange={(e) => setJornada(e.target.value)}
              placeholder="Ej: 48 o 30"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Nombre Jefe Directo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombreJefe}
              onChange={(e) => setNombreJefe(e.target.value)}
              placeholder="Ej: LUIS CARLOS SANCHEZ"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Fecha Tentativa Ingreso <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fechaTentativa}
              onChange={(e) => setFechaTentativa(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700 font-semibold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Fecha Término Contrato (Opcional)
            </label>
            <input
              type="date"
              value={fechaTermino}
              onChange={(e) => setFechaTermino(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700"
            />
          </div>
        </div>

        {/* Benefits Checks */}
        <div className="pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
            Beneficios Adicionales
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={incluyeEps}
                  onChange={(e) => setIncluyeEps(e.target.checked)}
                  className="rounded border-slate-300 text-usil-blue-600 focus:ring-usil-blue-500 h-4.5 w-4.5 transition-colors"
                />
                <span className="text-sm font-semibold text-slate-700">Incluye Cobertura EPS (Salud)</span>
              </label>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluyeMovilidad}
                    onChange={(e) => setIncluyeMovilidad(e.target.checked)}
                    className="rounded border-slate-300 text-usil-blue-600 focus:ring-usil-blue-500 h-4.5 w-4.5 transition-colors"
                  />
                  <span className="text-sm font-semibold text-slate-700">Incluye Asignación Movilidad</span>
                </label>
                {incluyeMovilidad && (
                  <input
                    type="number"
                    value={montoMovilidad || ''}
                    onChange={(e) => setMontoMovilidad(Number(e.target.value))}
                    placeholder="Monto diario S/"
                    className="w-full max-w-[200px] px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700 animate-slide-in ml-7"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluyeTarjetaAlimentos}
                    onChange={(e) => setIncluyeTarjetaAlimentos(e.target.checked)}
                    className="rounded border-slate-300 text-usil-blue-600 focus:ring-usil-blue-500 h-4.5 w-4.5 transition-colors"
                  />
                  <span className="text-sm font-semibold text-slate-700">Incluye Tarjeta de Alimentos (Provis)</span>
                </label>
                {incluyeTarjetaAlimentos && (
                  <input
                    type="number"
                    value={montoTarjetaAlimentos || ''}
                    onChange={(e) => setMontoTarjetaAlimentos(Number(e.target.value))}
                    placeholder="Monto mensual S/"
                    className="w-full max-w-[200px] px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700 animate-slide-in ml-7"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={incluyeBonoTransporte}
                    onChange={(e) => setIncluyeBonoTransporte(e.target.checked)}
                    className="rounded border-slate-300 text-usil-blue-600 focus:ring-usil-blue-500 h-4.5 w-4.5 transition-colors"
                  />
                  <span className="text-sm font-semibold text-slate-700">Incluye Bono de Transporte</span>
                </label>
                {incluyeBonoTransporte && (
                  <input
                    type="number"
                    value={montoBonoTransporte || ''}
                    onChange={(e) => setMontoBonoTransporte(Number(e.target.value))}
                    placeholder="Monto diario S/"
                    className="w-full max-w-[200px] px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-usil-blue-500 focus:ring-4 focus:ring-usil-blue-500/10 outline-none transition-all duration-200 text-slate-700 animate-slide-in ml-7"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 border border-slate-100 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">4. Plantilla de Carta Oferta</h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">Puedes respetar el calculo automatico o fijar manualmente una plantilla del catalogo legado.</p>
          </div>
          <div className="rounded-full border border-usil-blue-100 bg-usil-blue-50 px-3 py-1 text-[11px] font-bold text-usil-blue-700">
            {plantillaManual ? 'Seleccion manual' : 'Regla automatica'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{templateMeta?.emoji || '📄'}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">{plantillaCarta}</span>
                <Sparkles className="h-4 w-4 text-usil-blue-500" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{templateMeta?.desc || 'Plantilla seleccionada para la oferta actual.'}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            placeholder="Buscar tipo de carta..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition-all focus:border-usil-blue-500 focus:bg-white focus:ring-4 focus:ring-usil-blue-500/10 md:max-w-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPlantillaManual(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Recalcular
            </button>
            <button
              type="button"
              onClick={() => setPlantillaManual(true)}
              className="rounded-lg border border-usil-blue-200 bg-usil-blue-50 px-3 py-2 text-xs font-bold text-usil-blue-700 transition-colors hover:bg-usil-blue-100"
            >
              Fijar manualmente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((item) => {
            const active = item.id === plantillaCarta;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPlantillaCarta(item.id);
                  setPlantillaManual(true);
                }}
                className={`rounded-2xl border p-4 text-left transition-all ${active ? 'border-usil-blue-300 bg-usil-blue-50 shadow-sm shadow-usil-blue-100/70' : 'border-slate-100 bg-slate-50/60 hover:border-slate-200 hover:bg-white'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800">{item.label}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          Cancelar
        </button>
        
        <button
          type="submit"
          className="flex items-center gap-1.5 px-5 py-2.5 bg-usil-blue-600 hover:bg-usil-blue-700 text-white rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm active:scale-[0.98]"
        >
          <Save className="w-4.5 h-4.5" />
          <span>Guardar Solicitud</span>
        </button>
      </div>
    </form>
  );
};
