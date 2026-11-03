import { describe, expect, it } from 'vitest';

import { errorMessage } from './errorMessages';

const firebaseError = (code: string) =>
  Object.assign(new Error(`Firebase: Error (${code}).`), { code, name: 'FirebaseError' });

describe('errorMessage', () => {
  it('shows Romanian text for Firebase sign-in errors', () => {
    expect(errorMessage(firebaseError('auth/invalid-credential'), 'x')).toBe('Email sau parolă incorectă.');
    expect(errorMessage(firebaseError('auth/email-already-in-use'), 'x')).toMatch(/^Există deja un cont/);
    expect(errorMessage(firebaseError('auth/network-request-failed'), 'x')).toMatch(/conexiune/);
  });

  it('never shows a raw Firebase message', () => {
    expect(errorMessage(firebaseError('auth/some-new-code'), 'Autentificare eșuată.')).toBe('Autentificare eșuată.');
    expect(errorMessage(new Error('Firebase: internal error'), 'Încearcă din nou.')).toBe('Încearcă din nou.');
  });

  it('keeps the app and server messages, which are already in Romanian', () => {
    expect(errorMessage(new Error('Coșul este gol.'), 'x')).toBe('Coșul este gol.');
    expect(errorMessage('not an error', 'Eroare.')).toBe('Eroare.');
  });
});
