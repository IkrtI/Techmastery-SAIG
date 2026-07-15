import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { loadEnv } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

const env = loadEnv();
await connectDb();

const app = createApp();

if (env.NODE_ENV === 'production') {
  // Single origin: serve the built client + SPA fallback (SPECS §10).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, '../../client/dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// :3000 is FIXED — KMITL SSO redirect URIs are registered against it.
app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
});
