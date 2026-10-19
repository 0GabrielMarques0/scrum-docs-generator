import { Request, Response, NextFunction, RequestHandler } from 'express';

/** Error with an HTTP status whose message is safe to show to the client */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Forwards rejected promises from async handlers to the error middleware */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// Express identifies error middleware by its 4 parameters
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // body-parser errors
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requisição muito grande. Reduza o tamanho ou a quantidade de imagens.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  // Internal details stay in the logs, never in the response
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}
