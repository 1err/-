import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, onValue, off, Database } from 'firebase/database';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, StorageReference, FirebaseStorage } from 'firebase/storage';

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
let storage: FirebaseStorage | null = null;
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
    storage = getStorage(app);
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

// Helper to get shared path (all devices use the same path for syncing)
const getSharedPath = (path: string): string => {
  // Use a shared path so all devices can sync together
  // Since this is a personal app for two people, we use a shared space
  return `shared/${path}`;
};

// Firebase sync functions
export const firebaseSync = {
  // Save to Firebase
  save: async (path: string, data: any): Promise<void> => {
    if (!isFirebaseReady()) return;
    try {
      const dbRef = ref(database!, getSharedPath(path));
      await set(dbRef, data);
      console.log('✅ Saved to Firebase:', path);
    } catch (error) {
      console.error('Firebase save error:', error);
    }
  },

  // Get from Firebase
  get: async (path: string): Promise<any> => {
    if (!isFirebaseReady()) return null;
    try {
      const dbRef = ref(database!, getSharedPath(path));
      const snapshot = await get(dbRef);
      const data = snapshot.exists() ? snapshot.val() : null;
      if (data) {
        console.log('✅ Loaded from Firebase:', path, Object.keys(data).length, 'items');
      }
      return data;
    } catch (error) {
      console.error('Firebase get error:', error);
      return null;
    }
  },

  // Delete from Firebase
  delete: async (path: string): Promise<void> => {
    if (!isFirebaseReady()) return;
    try {
      const dbRef = ref(database!, getSharedPath(path));
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
      const dbRef = ref(database!, getSharedPath(path));
      console.log('👂 Listening to Firebase changes:', path);
      onValue(dbRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : null;
        console.log('📥 Received Firebase update:', path, data ? Object.keys(data).length + ' items' : 'empty');
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

// Firebase Storage functions for large files (images/videos)
export const firebaseStorage = {
  // Upload base64 image/video to Firebase Storage and return URL
  uploadMedia: async (base64Data: string, memoryId: string, type: 'image' | 'video'): Promise<string | null> => {
    if (!isFirebaseReady() || !storage) {
      console.warn('Firebase Storage not ready, skipping upload');
      return null;
    }

    try {
      // Determine file extension
      const extension = type === 'image' 
        ? (base64Data.startsWith('data:image/jpeg') ? 'jpg' : 
           base64Data.startsWith('data:image/png') ? 'png' : 
           base64Data.startsWith('data:image/gif') ? 'gif' : 'jpg')
        : (base64Data.startsWith('data:video/mp4') ? 'mp4' : 'mp4');

      // Create storage reference
      const fileRef = storageRef(storage, `memories/${memoryId}.${extension}`);
      
      // Upload base64 string
      console.log(`📤 Uploading ${type} to Firebase Storage:`, memoryId);
      await uploadString(fileRef, base64Data, 'data_url');
      
      // Get download URL
      const downloadURL = await getDownloadURL(fileRef);
      console.log(`✅ Uploaded to Storage, URL:`, downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Firebase Storage upload error:', error);
      return null;
    }
  }
};

