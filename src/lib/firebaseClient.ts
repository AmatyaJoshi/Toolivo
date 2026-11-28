import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

export async function signInWithGoogleOptional(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(firebaseAuth, provider);
  return result.user;
}

export async function signOutOptional(): Promise<void> {
  await signOut(firebaseAuth);
}

export function subscribeOptionalAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}
