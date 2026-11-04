import * as firebaseAuthModule from 'firebase/auth';
import {
  EmailAuthProvider,
  getAuth,
  initializeAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  updateProfile,
  type User,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { clearStoredSession, firebaseAuthStorage } from './sessionStorage';

let auth: Auth | null = null;
let app: FirebaseApp | null = null;

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBmyVr52GxqB0igJJry00rNsbx0PlTz0Pg',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dacus-b40f9.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'dacus-b40f9',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dacus-b40f9.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '216949470003',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:216949470003:ios:deb857c248586904a90446',
};

// `getReactNativePersistence` exists only in Firebase's React Native build (which Metro picks), not in the
// browser typings; without it the login lives in memory and is gone on the next app start.
const { getReactNativePersistence } = firebaseAuthModule as unknown as {
  getReactNativePersistence?: (storage: typeof firebaseAuthStorage) => Persistence;
};

const createAuth = (firebaseApp: FirebaseApp): Auth => {
  if (Platform.OS === 'web' || !getReactNativePersistence) return getAuth(firebaseApp);
  try {
    return initializeAuth(firebaseApp, { persistence: getReactNativePersistence(firebaseAuthStorage) });
  } catch {
    // Already initialized (e.g. after a fast refresh): reuse that instance.
    return getAuth(firebaseApp);
  }
};

export const initFirebase = (): { auth: Auth } => {
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
    auth = createAuth(app);
  }
  return { auth: auth! };
};

export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    const { auth: a } = initFirebase();
    return a;
  }
  return auth;
};

export type FirebaseUser = User;

export const loginWithFirebase = async (
  email: string,
  password: string,
): Promise<{ userId: string; email: string; idToken: string; name: string }> => {
  const auth = getFirebaseAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await result.user.getIdToken(true);

  const name = result.user.displayName || result.user.email?.split('@')[0] || 'Client';

  return {
    userId: result.user.uid,
    email: result.user.email!,
    idToken,
    name,
  };
};

export const registerWithFirebase = async (
  email: string,
  password: string,
  name?: string,
): Promise<{ userId: string; email: string; idToken: string }> => {
  const auth = getFirebaseAuth();
  const displayName = name || email.split('@')[0];
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Save the name on the Firebase profile so it shows up in the app (greeting, account).
  await updateProfile(result.user, { displayName });
  const idToken = await result.user.getIdToken(true);

  return {
    userId: result.user.uid,
    email: result.user.email!,
    idToken,
  };
};

export const logoutFromFirebase = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
  await clearStoredSession();
};

export const getCurrentFirebaseUser = (): User | null => {
  const auth = getFirebaseAuth();
  return auth.currentUser;
};

export const getFirebaseIdToken = async (forceRefresh = false): Promise<string | null> => {
  const user = getCurrentFirebaseUser();
  if (!user) return null;
  return user.getIdToken(forceRefresh);
};

export const onFirebaseAuthChange = (callback: (user: User | null) => void): (() => void) => {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
};

export const resetPasswordFirebase = async (email: string): Promise<void> => {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email);
};

/** Firebase asks for a recent login before a password change, so the current password is checked first. */
export const changePasswordFirebase = async (currentPassword: string, newPassword: string): Promise<void> => {
  const user = getCurrentFirebaseUser();
  if (!user?.email) {
    throw new Error('Sesiunea a expirat. Intră din nou în cont.');
  }
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await firebaseUpdatePassword(user, newPassword);
};

/** Resolves once Firebase has loaded the login saved on the device (if any). */
export const waitForFirebaseAuth = async (): Promise<void> => {
  await getFirebaseAuth().authStateReady();
};
