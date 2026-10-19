import { HttpError } from '../../middleware/errors.js';
import { AiPart, AiProvider, JsonRequest, TextRequest } from './types.js';

/**
 * Google Gemini via the Generative Language REST API (free tier with a Google AI Studio key).
 * Free-tier quotas are per minute and per day, so 429s are translated into actionable messages.
 */

const API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 4 * 60_000;
// Thinking models count their reasoning against this limit, so keep it generous
const MAX_OUTPUT_TOKENS = 32_768;
// 500/503 ("model is experiencing high demand") are usually gone within seconds
const TRANSIENT_STATUSES = [500, 502, 503, 504];
const RETRY_DELAYS_MS = [2_000, 6_000];

interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
}

function toGeminiParts(parts: AiPart[]) {
  return parts.map(part =>
    part.type === 'text'
      ? { text: part.text }
      : { inlineData: { mimeType: part.image.mimeType, data: part.image.base64 } }
  );
}

export class GeminiProvider implements AiProvider {
  readonly label: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    /** Used when the main model's free quota runs out (each model has its own daily quota) */
    private readonly fallbackModel?: string
  ) {
    this.label = fallbackModel ? `Gemini (${model}, fallback ${fallbackModel})` : `Gemini (${model})`;
  }

  /** Calls the API, retrying transient failures (overload, server errors, network) with backoff */
  private async request(model: string, body: string): Promise<{ response: Response; data: GenerateContentResponse }> {
    for (let attempt = 0; ; attempt++) {
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      try {
        const response = await fetch(`${API_URL}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const data = (await response.json().catch(() => ({}))) as GenerateContentResponse;

        if (!TRANSIENT_STATUSES.includes(response.status) || isLastAttempt) return { response, data };
        console.warn(`[Gemini] ${response.status} ${data.error?.status ?? ''} - retrying (${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      } catch (error) {
        if (isLastAttempt) {
          console.error('[Gemini] Network error:', error);
          throw new HttpError(502, 'Não foi possível falar com a IA. Tente novamente.');
        }
        console.warn(`[Gemini] Network error - retrying (${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }

  private async generate(request: TextRequest, jsonMode: boolean): Promise<string> {
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: toGeminiParts(request.parts) }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...(jsonMode && { responseMimeType: 'application/json' }),
      },
    });

    let { response, data } = await this.request(this.model, body);
    if (response.status === 429 && this.fallbackModel) {
      console.warn(`[Gemini] Quota exhausted for ${this.model} - using ${this.fallbackModel}`);
      ({ response, data } = await this.request(this.fallbackModel, body));
    }

    if (!response.ok) {
      const status = data.error?.status ?? '';
      const message = data.error?.message ?? '';
      console.error(`[Gemini] ${response.status} ${status}:`, message);

      if (/API key|API_KEY/i.test(message) || response.status === 401 || response.status === 403) {
        throw new HttpError(503, 'Chave do Gemini inválida ou sem permissão (verifique GEMINI_API_KEY)');
      }
      if (response.status === 429 || status === 'RESOURCE_EXHAUSTED') {
        throw new HttpError(429, 'Limite gratuito do Gemini atingido. Aguarde um minuto (ou até amanhã, se for o limite diário).');
      }
      if (response.status === 404) {
        throw new HttpError(503, `Modelo "${this.model}" não encontrado no Gemini (verifique GEMINI_MODEL)`);
      }
      if (response.status === 503) {
        throw new HttpError(503, 'A IA do Google está sobrecarregada no momento. Tente novamente em alguns instantes.');
      }
      if (response.status === 400) {
        throw new HttpError(400, 'A IA rejeitou a requisição. Verifique o formato e o tamanho das imagens.');
      }
      throw new HttpError(502, 'IA indisponível no momento. Tente novamente.');
    }

    if (data.promptFeedback?.blockReason) {
      throw new HttpError(422, 'A IA recusou o conteúdo. Revise as imagens e tente novamente.');
    }

    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new HttpError(502, 'A resposta da IA passou do limite de tamanho. Divida a tela em partes menores.');
    }
    if (candidate?.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason)) {
      console.error('[Gemini] Unexpected finishReason:', candidate.finishReason);
      throw new HttpError(422, 'A IA recusou o conteúdo. Revise as imagens e tente novamente.');
    }

    // Skip "thought" parts some models return alongside the answer
    const text = (candidate?.content?.parts ?? [])
      .filter(part => !part.thought && part.text)
      .map(part => part.text)
      .join('')
      .trim();

    if (!text) throw new HttpError(502, 'A IA retornou uma resposta vazia. Tente novamente.');
    return text;
  }

  generateText(request: TextRequest): Promise<string> {
    return this.generate(request, false);
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<T> {
    const text = await this.generate(
      {
        ...request,
        parts: [
          ...request.parts,
          { type: 'text', text: `Responda apenas com um objeto JSON válido neste formato:\n${request.example}` },
        ],
      },
      true
    );

    try {
      return request.schema.parse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
    } catch (error) {
      console.error('[Gemini] Invalid JSON response:', error);
      throw new HttpError(502, 'A IA retornou uma resposta inválida. Tente novamente.');
    }
  }
}
