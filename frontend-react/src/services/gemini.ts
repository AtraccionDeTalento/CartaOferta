// Cliente para extracción de datos de candidatos con Gemini.
// Las keys viven en VITE_GEMINI_API_KEY / VITE_GEMINI_API_KEYS (build-time env vars). En un
// sitio 100% estático (GitHub Pages) quedan visibles en el bundle JS — deben estar restringidas
// por HTTP referrer y con cuota acotada en Google AI Studio / Cloud Console.
const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
// VITE_GEMINI_API_KEYS: lista opcional separada por comas para fallback automático si una
// key se queda sin cuota (429). Nunca hardcodear keys aquí — GitHub bloquea el push si
// detecta credenciales en el código. Configúralas como variables de entorno (.env.local
// para desarrollo, secreto de GitHub Actions VITE_GEMINI_API_KEYS para el build público).
const envKeysList = (import.meta.env.VITE_GEMINI_API_KEYS as string | undefined)?.split(',').map(k => k.trim()).filter(Boolean) || [];

const GEMINI_API_KEYS = Array.from(new Set([
  ...(envKey ? [envKey] : []),
  ...envKeysList,
]));

// gemini-2.0-flash quedó sin cuota gratuita (limit: 0) — usar el alias "latest" evita que
// vuelva a pasar cuando Google retire el modelo fijo que estemos usando.
const MODEL = 'gemini-flash-latest';

export const isGeminiConfigured = GEMINI_API_KEYS.length > 0;

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
  archivos?: Array<{ data: string; mimeType: string }>;
}): Promise<ExtractedCandidateData> {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error('Gemini no está configurado en este entorno (falta VITE_GEMINI_API_KEY).');
  }

  const parts: any[] = [{ text: PROMPT + input.texto }];
  const filesList = input.archivos || input.imagenes || [];
  for (const file of filesList) {
    parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
  }

  let lastError: Error | null = null;

  for (const key of GEMINI_API_KEYS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
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
        // Cuota agotada o key inválida: intenta con la siguiente key disponible.
        if (response.status === 429 || response.status === 403) {
          lastError = new Error(`Gemini respondió con error ${response.status}: ${errBody.slice(0, 200)}`);
          continue;
        }
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
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError || new Error('No se pudo completar la solicitud a Gemini con ninguna key disponible.');
}
