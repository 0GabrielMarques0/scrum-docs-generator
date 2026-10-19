import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { HttpError } from '../../middleware/errors.js';
import { AiPart, AiProvider, JsonRequest, TextRequest } from './types.js';

/** Claude via the Anthropic API (paid, billed per token). Enabled with AI_PROVIDER=anthropic. */

// Re-runs a request declined by safety classifiers on Anthropic's recommended fallback model
const FALLBACK_OPTIONS: Pick<Anthropic.Beta.MessageCreateParams, 'betas' | 'fallbacks'> = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
};

function toContent(parts: AiPart[]): Anthropic.Beta.BetaContentBlockParam[] {
  const lastImage = parts.map(p => p.type).lastIndexOf('image');
  return parts.map((part, index) =>
    part.type === 'text'
      ? { type: 'text' as const, text: part.text }
      : {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: part.image.mimeType, data: part.image.base64 },
          // Cache breakpoint after the last image: questions + generation for the same screen share this prefix
          ...(index === lastImage ? { cache_control: { type: 'ephemeral' as const } } : {}),
        }
  );
}

function assertNotRefused(response: { stop_reason: string | null }) {
  if (response.stop_reason === 'refusal') {
    throw new HttpError(422, 'A IA não conseguiu processar este conteúdo. Revise as imagens e tente novamente.');
  }
}

function toHttpError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (error instanceof Anthropic.RateLimitError) {
    throw new HttpError(429, 'Limite de uso da IA atingido. Aguarde alguns instantes e tente novamente.');
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error('[Claude] Bad request:', error.message);
    throw new HttpError(400, 'A IA rejeitou a requisição. Verifique o formato e o tamanho das imagens.');
  }
  if (error instanceof Anthropic.AuthenticationError) {
    console.error('[Claude] Authentication failed - check ANTHROPIC_API_KEY');
    throw new HttpError(503, 'IA indisponível no momento');
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`[Claude] API error ${error.status}:`, error.message);
    throw new HttpError(502, 'IA indisponível no momento. Tente novamente.');
  }
  throw error;
}

export class AnthropicProvider implements AiProvider {
  readonly label: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string) {
    this.label = `Claude (${model})`;
    this.client = new Anthropic({ apiKey, timeout: 5 * 60_000, maxRetries: 2 });
  }

  async generateText(request: TextRequest): Promise<string> {
    try {
      const response = await this.client.beta.messages
        .stream({
          model: this.model,
          max_tokens: 64000,
          system: request.system,
          output_config: { effort: request.effort },
          messages: [{ role: 'user', content: toContent(request.parts) }],
          ...FALLBACK_OPTIONS,
        })
        .finalMessage();

      assertNotRefused(response);
      if (response.stop_reason === 'max_tokens') {
        throw new HttpError(502, 'O documento gerado ficou grande demais. Divida a tela em partes menores.');
      }
      return response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');
    } catch (error) {
      toHttpError(error);
    }
  }

  async generateJson<T>(request: JsonRequest<T>): Promise<T> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: 16000,
        system: request.system,
        output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
        messages: [{ role: 'user', content: toContent(request.parts) }],
        ...FALLBACK_OPTIONS,
      });

      assertNotRefused(response);
      if (!response.parsed_output) {
        throw new HttpError(502, 'A IA retornou uma resposta inválida. Tente novamente.');
      }
      return response.parsed_output as T;
    } catch (error) {
      toHttpError(error);
    }
  }
}
