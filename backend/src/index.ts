import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { requirementsRoutes } from './routes/requirements.routes.js';
import { projectsRoutes } from './routes/projects.routes.js';
import { githubRoutes } from './routes/github.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { authRoutes, authMiddleware } from './routes/auth.routes.js';
import screensRoutes from './routes/screens.routes.js';
import { initDatabase } from './database/init.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Scrum Docs Generator API',
      version: '2.0.0',
      description: 'API para geração de documentos de requisitos a partir de prints de telas',
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    
    // Public routes (no auth required)
    app.use('/api/auth', authRoutes);
    
    // Health check (public)
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Protected routes (auth required)
    app.use('/api/requirements', authMiddleware, requirementsRoutes);
    app.use('/api/projects', authMiddleware, projectsRoutes);
    app.use('/api/github', authMiddleware, githubRoutes);
    app.use('/api/export', authMiddleware, exportRoutes);
    app.use('/api/screens', authMiddleware, screensRoutes);
    
    // Serve uploaded images
    app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
