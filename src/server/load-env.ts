import nextEnv from "@next/env";

/** Load .env, .env.local etc. the same way Next.js does, for scripts run outside Next.js. */
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
