import { loadEnv } from './config/env.js';
import { buildServer } from './server.js';

const start = async () => {
  const env = loadEnv();
  const app = await buildServer(env);

  try {
    await app.listen({
      host: '0.0.0.0',
      port: env.PORT,
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
