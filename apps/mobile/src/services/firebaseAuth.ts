import {
  initializeAuth,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getIdToken,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  type User,
  type Auth,
} from 'firebase/auth';
import { initializeApp, getApp, type FirebaseApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import {
  setStoredSession,
  getStoredSession,
  clearStoredSession,
  type StoredSession,
} from './sessionStorage';

let auth: Auth | null = null;
let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBmyVr52GxqB0igJJry00rNsbx0PlTz0Pg',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dacus-b40f9.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'dacus-b40f9',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dacus-b40f9.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '216949470003',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:216949470003:ios:deb857c248586904a90446',
};

export const initFirebase = (): { auth: Auth; db: Firestore } => {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { auth: auth!, db: db! };
};

export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    const { auth: a } = initFirebase();
    return a;
  }
  return auth;
};

export const getFirebaseDb = (): Firestore => {
  if (!db) {
    const { db: d } = initFirebase();
    return d;
  }
  return db;
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

export const changePasswordFirebase = async (newPassword: string): Promise<void> => {
  const user = getCurrentFirebaseUser();
  if (!user) {
    throw new Error('No user logged in');
  }
  await firebaseUpdatePassword(user, newPassword);
};
