import { defineNitroConfig } from "nitro/config";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const BACKEND_BASE = (env.VITE_API_URL || "http://ins-api.talentbro.in").replace(/\/+$/, "");

export default defineNitroConfig({
  routeRules: {
    "/api/**": {
      proxy: { to: `${BACKEND_BASE}/api/**` },
    },
    "/media/**": {
      proxy: { to: `${BACKEND_BASE}/media/**` },
    },
  },
});