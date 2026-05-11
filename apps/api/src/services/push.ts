import { type DeviceRegistration } from './commerceStore.js';

const FCM_ENDPOINT = 'https://fcm.googleapis.com/v1';

interface FcmMessage {
  message: {
    token?: string;
    topic?: string;
    notification: {
      title: string;
      body?: string;
    };
    data?: Record<string, string>;
    android?: {
      priority: 'normal' | 'high';
      notification?: {
        channel_id?: string;
      };
    };
    apns?: {
      headers?: Record<string, string>;
      payload?: {
        aps?: {
          badge?: number;
        };
      };
    };
  };
}

async function getAccessToken(): Promise<string> {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    throw new Error('Firebase credentials not configured');
  }

  const jwt = await import('jsonwebtoken').then((jwt) =>
    jwt.sign(
      {
        iss: clientEmail,
        aud: 'https://oauth2.googleapis.com/token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
      },
      privateKey,
      { algorithm: 'RS256' },
    ),
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function sendPushNotification(
  store: { getDeviceRegistrations: (userId: string) => Promise<DeviceRegistration[]> },
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<number> {
  const devices = await store.getDeviceRegistrations(userId);
  const pushTokens = devices
    .map((d) => d.pushToken)
    .filter((token): token is string => token.length > 0);

  if (pushTokens.length === 0) {
    return 0;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('[Push] Firebase project ID not configured');
    return 0;
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    console.error('[Push] Failed to get access token:', error);
    return 0;
  }

  let sentCount = 0;

  for (const token of pushTokens) {
    const message: FcmMessage = {
      message: {
        token,
        notification: { title, body },
        ...(data ? { data: data } : {}),
        android: { priority: 'high' },
      },
    };

    try {
      const response = await fetch(`${FCM_ENDPOINT}/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        sentCount++;
      } else {
        const error = await response.text();
        console.warn(`[Push] Failed to send to ${token.slice(0, 20)}: ${error}`);
      }
    } catch (error) {
      console.warn(`[Push] Error sending to token:`, error);
    }
  }

  return sentCount;
}

export async function sendPushToTopic(
  topic: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<number> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('[Push] Firebase project ID not configured');
    return 0;
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    console.error('[Push] Failed to get access token:', error);
    return 0;
  }

  const message: FcmMessage = {
    message: {
      topic: topic.startsWith('/topics/') ? topic : `/topics/${topic}`,
      notification: { title, body },
      ...(data ? { data: data } : {}),
      android: { priority: 'high' },
    },
  };

  try {
    const response = await fetch(`${FCM_ENDPOINT}/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });

    return response.ok ? 1 : 0;
  } catch (error) {
    console.error('[Push] Error sending to topic:', error);
    return 0;
  }
}

export async function subscribeToTopic(token: string, topic: string): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    return false;
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch {
    return false;
  }

  try {
    const response = await fetch(`${FCM_ENDPOINT}/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          topic: topic.startsWith('/topics/') ? topic : `/topics/${topic}`,
        },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
