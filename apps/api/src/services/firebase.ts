import { readFileSync } from 'node:fs';
import path from 'node:path';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type FirebaseConfig = {
  enabled?: boolean;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  serviceAccountPath?: string;
  databaseURL?: string;
  storageBucket?: string;
  emulatorHost?: string;
};

const normalizePrivateKey = (value: string) => value.replace(/\\n/g, '\n').trim();

const resolveApp = (
  config: Required<Pick<FirebaseConfig, 'projectId' | 'clientEmail' | 'privateKey'>> &
    FirebaseConfig,
): App => {
  const appName = `dacus-api-${config.projectId}`;
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return existing;

  return initializeApp(
    {
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: normalizePrivateKey(config.privateKey),
      }),
      ...(config.databaseURL ? { databaseURL: config.databaseURL } : {}),
      ...(config.storageBucket ? { storageBucket: config.storageBucket } : {}),
    },
    appName,
  );
};

export const createFirestoreClient = (config: FirebaseConfig): Firestore | null => {
  // If not enabled, return null (will use in-memory store)
  if (!config.enabled) return null;

  // Try to load from service account file if provided
  let projectId = config.projectId;
  let clientEmail = config.clientEmail;
  let privateKey = config.privateKey;

  if (config.serviceAccountPath && (!projectId || !clientEmail || !privateKey)) {
    try {
      const absolutePath = path.isAbsolute(config.serviceAccountPath)
        ? config.serviceAccountPath
        : path.resolve(process.cwd(), config.serviceAccountPath);

      const raw = readFileSync(absolutePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };

      projectId = projectId ?? parsed.project_id;
      clientEmail = clientEmail ?? parsed.client_email;
      privateKey = privateKey ?? parsed.private_key;
    } catch {
      // Service account file not found, continue with env vars
    }
  }

  // No valid credentials - return null (use in-memory store)
  if (!projectId || !clientEmail || !privateKey) {
    console.log('[Firebase] No credentials, using in-memory store instead');
    return null;
  }

  const app = resolveApp({
    ...config,
    projectId,
    clientEmail,
    privateKey,
  });

  const db = getFirestore(app);

  // Use emulator if configured via env var
  if (config.emulatorHost) {
    process.env.FIRESTORE_EMULATOR_HOST = config.emulatorHost;
  }

  return db;
};
