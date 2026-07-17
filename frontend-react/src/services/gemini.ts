// Cliente para extracción de datos de candidatos con Gemini.
// La key vive en VITE_GEMINI_API_KEY (build-time env var). En un sitio 100% estático
// (GitHub Pages) esta key queda visible en el bundle JS — debe estar restringida por
// HTTP referrer y con cuota acotada en Google AI Studio / Cloud Console.
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = 'gemini-2.0-flash';

export const isGeminiConfigured = !!GEMINI_API_KEY;

export interface ExtractedCandidateData {
  nombres_apellidos?: string;
  dni?: string;
  salario?: number;
  modalidad?: string;
  tiempo_contrato?: string;
  nombre_jefe_directo?: string;
  fecha_tentativa_ingreso?: string;
  puesto_sugerido?: string;
  observaciones?: string;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    nombres_apellidos: { type: 'STRING', description: 'Nombre completo del candidato' },
    dni: { type: 'STRING', description: 'DNI o Carnet de Extranjería, solo dígitos' },
    salario: { type: 'NUMBER', description: 'Salario mensual mencionado, en soles, solo el número' },
    modalidad: { type: 'STRING', enum: ['FULL TIME', 'PART TIME', 'PRACTICANTE PRE', 'PRACTICANTE PRO'] },
    tiempo_contrato: { type: 'STRING', description: 'Ej: "6 meses", "1 año", "Indeterminado"' },
    nombre_jefe_directo: { type: 'STRING', description: 'Nombre del jefe directo o reporta a' },
    fecha_tentativa_ingreso: { type: 'STRING', description: 'Fecha tentativa de ingreso en formato YYYY-MM-DD si se menciona' },
    puesto_sugerido: { type: 'STRING', description: 'Puesto o cargo mencionado para el candidato' },
    observaciones: { type: 'STRING', description: 'Cualquier condición u observación relevante no cubierta por otros campos' },
  },
};

const PROMPT = `Eres un asistente de RRHH. A partir del siguiente texto (briefing de un Business Partner y/o contenido de un CV), extrae únicamente los datos que estén explícitamente mencionados. Si un dato no aparece, omite el campo (no inventes valores). Responde solo con el JSON estructurado.\n\n--- CONTENIDO ---\n`;

export async function extractCandidateData(input: {
  texto: string;
  imagenes?: Array<{ data: string; mimeType: string }>;
}): Promise<ExtractedCandidateData> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini no está configurado en este entorno (falta VITE_GEMINI_API_KEY).');
  }

  const parts: any[] = [{ text: PROMPT + input.texto }];
  for (const img of input.imagenes || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini respondió con error ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini no devolvió contenido utilizable.');
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error('No se pudo interpretar la respuesta de Gemini.');
  }
}
