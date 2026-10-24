import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { allowedOrigins, isProd } from './config/env.js';
import routes from './routes/index.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/error.js';
import { openapi } from './openapi.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render terminates TLS; needed for secure cookies and correct client IPs
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(null, false)),
    credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isProd || process.env.ENABLE_DOCS === 'true') app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api/v1', (req, res, next) => (req.path === '/health' ? next() : csrfProtection(req, res, next)), routes);
  app.get('/', (_req, res) => res.json({ name: 'FoodRescue API', docs: '/api/docs', health: '/api/v1/health' }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
