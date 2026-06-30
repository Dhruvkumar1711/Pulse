import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);

// Force Local Persistence to ensure sessions survive browser reloads
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

let cachedAccessToken: string | null = null;

export const getGoogleAccessToken = () => cachedAccessToken;
export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return result.user;
  } catch (error: any) {
    console.warn("Popup blocked or failed, trying redirect flow...", error);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (redirectError) {
      console.error("Google sign in redirect failed:", redirectError);
      throw redirectError;
    }
  }
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const handleRedirectResultToken = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }
    }
  } catch (error) {
    console.error("Error getting redirect result:", error);
  }
};

// Simple email-based sandbox logins for preview in strict iframe environments
async function hashPassword(password: string): Promise<string> {
  try {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback if crypto is not supported in some iframe environments
    return btoa(password + "pulse_salt_2026");
  }
}

interface SandboxAccount {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

export const signUpWithEmailAndPasswordCustom = async (email: string, password: string, displayName: string) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(result.user, {
      displayName: displayName
    });
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/internal-error') {
      console.warn("Email/Password Auth disabled in Firebase. Falling back to Local Sandbox Registration...");
      
      const accountsJson = localStorage.getItem('pulse_sandbox_accounts') || '{}';
      const accounts = JSON.parse(accountsJson);
      
      if (accounts[cleanEmail]) {
        throw new Error('An account with this email already exists in Sandbox mode. Please Sign In instead.');
      }
      
      const uid = `sandbox-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const passwordHash = await hashPassword(password);
      
      const newAccount: SandboxAccount = {
        uid,
        email: cleanEmail,
        displayName,
        passwordHash
      };
      
      accounts[cleanEmail] = newAccount;
      localStorage.setItem('pulse_sandbox_accounts', JSON.stringify(accounts));
      
      const localUser = {
        uid,
        displayName,
        email: cleanEmail,
        isLocalSandbox: true
      };
      localStorage.setItem('pulse_local_user', JSON.stringify(localUser));
      return localUser;
    }
    
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email address is already in use.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('The password is too weak. Must be at least 6 characters.');
    }
    
    throw error;
  }
};

export const signInWithEmailAndPasswordCustom = async (email: string, password: string) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/internal-error') {
      const accountsJson = localStorage.getItem('pulse_sandbox_accounts') || '{}';
      const accounts = JSON.parse(accountsJson);
      const account = accounts[cleanEmail];
      
      if (account) {
        const passwordHash = await hashPassword(password);
        if (account.passwordHash === passwordHash) {
          const localUser = {
            uid: account.uid,
            displayName: account.displayName,
            email: cleanEmail,
            isLocalSandbox: true
          };
          localStorage.setItem('pulse_local_user', JSON.stringify(localUser));
          return localUser;
        } else {
          throw new Error('Incorrect password. Please try again.');
        }
      }
      
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email/Password Auth is disabled in the cloud, and no local sandbox account exists. Please Sign Up first to register locally.');
      }
    }
    
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password. Please try again or Sign Up if you don\'t have an account.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This user account has been disabled.');
    }
    
    throw error;
  }
};

export const loginAsDemoUser = async (email: string) => {
  try {
    // Attempt login
    const result = await signInWithEmailAndPassword(auth, email, "password123");
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-allowed') {
      console.warn("Email/Password Auth is disabled in Firebase console. Falling back to Local Sandbox...");
      const localUser = {
        uid: `sandbox-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        displayName: "Sandbox Explorer",
        email: email,
        isLocalSandbox: true,
      };
      localStorage.setItem('pulse_local_user', JSON.stringify(localUser));
      return localUser;
    }
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        // Create user
        const result = await createUserWithEmailAndPassword(auth, email, "password123");
        await updateProfile(result.user, {
          displayName: "Productive User"
        });
        return result.user;
      } catch (createError: any) {
        if (createError.code === 'auth/operation-not-allowed') {
          console.warn("Email/Password Auth creation disabled. Falling back to Local Sandbox...");
          const localUser = {
            uid: `sandbox-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
            displayName: "Sandbox Explorer",
            email: email,
            isLocalSandbox: true,
          };
          localStorage.setItem('pulse_local_user', JSON.stringify(localUser));
          return localUser;
        }
        console.error("Error creating demo user:", createError);
        throw createError;
      }
    }
    console.error("Demo login failed:", error);
    throw error;
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

