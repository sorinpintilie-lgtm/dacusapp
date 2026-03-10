import { loadEnv } from './config/env.js';
import { buildServer } from './server.js';

const start = async () => {
  const env = loadEnv();
  const app = buildServer(env);

  try {
    await app.listen({
      host: '0.0.0.0',
      port: env.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

