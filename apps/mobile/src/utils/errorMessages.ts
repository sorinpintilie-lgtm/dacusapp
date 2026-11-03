/**
 * Turns an error into a message for the customer. Firebase errors carry English, technical messages
 * ("Firebase: Error (auth/invalid-credential).") that must never reach the screen, so their codes map to
 * Romanian text; any other Firebase error falls back to the caller's message.
 */
const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email sau parolă incorectă.',
  'auth/invalid-login-credentials': 'Email sau parolă incorectă.',
  'auth/wrong-password': 'Email sau parolă incorectă.',
  'auth/user-not-found': 'Email sau parolă incorectă.',
  'auth/invalid-email': 'Email invalid.',
  'auth/missing-password': 'Completează parola.',
  'auth/email-already-in-use': 'Există deja un cont cu acest email. Intră în cont sau resetează parola.',
  'auth/weak-password': 'Parola trebuie să aibă cel puțin 8 caractere.',
  'auth/too-many-requests': 'Prea multe încercări. Încearcă din nou peste câteva minute.',
  'auth/network-request-failed': 'Nu există conexiune la internet. Verifică rețeaua și încearcă din nou.',
  'auth/user-disabled': 'Acest cont a fost dezactivat. Contactează-ne pentru detalii.',
  'auth/requires-recent-login': 'Din motive de securitate, intră din nou în cont și reîncearcă.',
  'auth/user-token-expired': 'Sesiunea a expirat. Intră din nou în cont.',
};

export const errorMessage = (error: unknown, fallback: string): string => {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code.startsWith('auth/')) return FIREBASE_MESSAGES[code] ?? fallback;
  if (!(error instanceof Error)) return fallback;
  if (/firebase/i.test(error.message)) return fallback;
  return error.message || fallback;
};
