import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { moodsRouter } from './routes/moods.js';
import { statsRouter } from './routes/stats.js';
import { metaRouter } from './routes/meta.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import { buildOpenApiDocument } from './docs/openapi.js';

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1); // Cloudflare + Traefik
  app.use(helmet());
  if (env().NODE_ENV !== 'production') {
    // Prod is same-origin (Express serves the built client) — no CORS needed.
    app.use(cors({ origin: env().APP_URL, credentials: true }));
  }
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter);
  app.use('/api/moods', moodsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/admin', adminRouter);

  // Swagger UI: public in dev, behind admin in prod (SPECS §5).
  const docsGuards = env().NODE_ENV === 'production' ? [requireAuth, requireAdmin] : [];
  app.use('/api/docs', ...docsGuards, swaggerUi.serve, swaggerUi.setup(buildOpenApiDocument()));

  app.use('/api', metaRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
