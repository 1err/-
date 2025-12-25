import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, onValue, off, Database } from 'firebase/database';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';

// Firebase configuration - will be provided by user
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Initialize Firebase
let app: any = null;
let database: Database | null = null;
let auth: Auth | null = null;
let isInitialized = false;

export const initFirebase = async (): Promise<boolean> => {
  if (isInitialized) return true;
  
  // Check if config is provided
  if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
    console.warn('Firebase config not provided. Running in local-only mode.');
    console.warn('Config check:', {
      apiKey: firebaseConfig.apiKey ? 'present' : 'missing',
      databaseURL: firebaseConfig.databaseURL ? 'present' : 'missing',
      envVars: {
        VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY ? 'present' : 'missing',
        VITE_FIREBASE_DATABASE_URL: import.meta.env.VITE_FIREBASE_DATABASE_URL ? 'present' : 'missing'
      }
    });
    return false;
  }

  try {
    console.log('Initializing Firebase...');
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
    
    // Sign in anonymously for simple authentication
    console.log('Signing in anonymously...');
    await signInAnonymously(auth);
    console.log('Firebase auth successful, user:', auth.currentUser?.uid);
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return false;
  }
};

export const getFirebaseDatabase = (): Database | null => {
  return database;
};

export const isFirebaseReady = (): boolean => {
  return isInitialized && database !== null;
};

// Helper to get user-specific path
const getUserPath = (path: string): string => {
  if (!auth?.currentUser) return path;
  return `users/${auth.currentUser.uid}/${path}`;
};

// Firebase sync functions
export const firebaseSync = {
  // Save to Firebase
  save: async (path: string, data: any): Promise<void> => {
    if (!isFirebaseReady()) return;
    try {
      const dbRef = ref(database!, getUserPath(path));
      await set(dbRef, data);
    } catch (error) {
      console.error('Firebase save error:', error);
    }
  },

  // Get from Firebase
  get: async (path: string): Promise<any> => {
    if (!isFirebaseReady()) return null;
    try {
      const dbRef = ref(database!, getUserPath(path));
      const snapshot = await get(dbRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Firebase get error:', error);
      return null;
    }
  },

  // Delete from Firebase
  delete: async (path: string): Promise<void> => {
    if (!isFirebaseReady()) return;
    try {
      const dbRef = ref(database!, getUserPath(path));
      await remove(dbRef);
    } catch (error) {
      console.error('Firebase delete error:', error);
    }
  },

  // Listen to changes (real-time sync)
  listen: (path: string, callback: (data: any) => void): (() => void) => {
    if (!isFirebaseReady()) {
      return () => {}; // Return no-op unsubscribe
    }
    try {
      const dbRef = ref(database!, getUserPath(path));
      onValue(dbRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : null;
        callback(data);
      });
      
      // Return unsubscribe function
      return () => {
        off(dbRef);
      };
    } catch (error) {
      console.error('Firebase listen error:', error);
      return () => {};
    }
  }
};

