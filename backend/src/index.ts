import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config.js';
import { authRoutes } from './routes/auth.routes.js';
import { projectsRoutes } from './routes/projects.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { authLimiter } from './middleware/rateLimits.js';
import { db, initDatabase } from './database/init.js';
import { closeBrowser } from './services/document.service.js';

const app = express();

// Railway / Vercel sit behind one proxy: needed for correct client IPs in rate limiting
app.set('trust proxy', 1);
app.disable('x-powered-by');

// API docs (dev only - swagger-ui needs inline scripts that the helmet CSP blocks)
if (!config.isProduction) {
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: { title: 'SpecAI API', version: '3.0.0' },
      servers: [{ url: `http://localhost:${config.port}` }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    apis: ['./src/routes/*.ts'],
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Requests without Origin (curl, health checks) don't carry browser credentials
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
}));

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', error: 'database unavailable' });
  }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth', express.json({ limit: '100kb' }), authRoutes);

// AI routes receive base64 images (up to 10 x 5 MB): larger body limit only here
app.use(
  '/api/projects/:projectId/ai',
  authMiddleware,
  express.json({ limit: '70mb' }),
  aiRoutes
);

app.use('/api/projects', authMiddleware, express.json({ limit: '3mb' }), projectsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await initDatabase();

    const server = app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`);
    });
    // AI generation can take minutes; keep connections open long enough
    server.requestTimeout = 6 * 60_000;

    const shutdown = async (signal: string) => {
      console.log(`${signal} received, shutting down...`);
      server.close();
      await closeBrowser();
      await db.end();
      process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
