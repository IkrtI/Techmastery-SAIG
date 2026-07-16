import { defineConfig } from "vite";
export default defineConfig({ preview: { port: 4173, proxy: { "/api": "http://localhost:3001" } } });
