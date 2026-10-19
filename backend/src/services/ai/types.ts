import type { z } from 'zod';

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type ImageMediaType = typeof SUPPORTED_IMAGE_TYPES[number];

export interface ScreenImage {
  base64: string;
  mimeType: ImageMediaType;
}

/** Provider-neutral message content: prints first, then the task text */
export type AiPart =
  | { type: 'image'; image: ScreenImage }
  | { type: 'text'; text: string };

export type AiEffort = 'medium' | 'high';

export interface TextRequest {
  system: string;
  parts: AiPart[];
  effort: AiEffort;
}

export interface JsonRequest<T> extends TextRequest {
  schema: z.ZodType<T>;
  /** Example of the expected JSON, for providers without native structured outputs */
  example: string;
}

export interface AiProvider {
  /** Shown in logs */
  readonly label: string;
  generateText(request: TextRequest): Promise<string>;
  generateJson<T>(request: JsonRequest<T>): Promise<T>;
}
