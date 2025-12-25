import { Memory, TodoItem } from '../types';
import { initFirebase, firebaseSync, isFirebaseReady } from './firebase';

const DB_NAME = 'LoveStoryDB';
const DB_VERSION = 1;
const STORE_MEMORIES = 'memories';
const STORE_TODOS = 'todos';
const STORE_SETTINGS = 'settings';

// Initialize Firebase on module load
let firebaseInitPromise: Promise<boolean> | null = null;
export const initializeFirebase = async (): Promise<boolean> => {
  if (!firebaseInitPromise) {
    firebaseInitPromise = initFirebase();
  }
  return firebaseInitPromise;
};

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        db.createObjectStore(STORE_MEMORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TODOS)) {
        db.createObjectStore(STORE_TODOS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };
  });
};

// Generic Transaction Helper
const performTransaction = <T>(
  storeName: string, 
  mode: IDBTransactionMode, 
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      
      let request;
      try {
        request = callback(store);
      } catch (e) {
        reject(e);
        return;
      }

      tx.oncomplete = () => resolve((request as IDBRequest<T>)?.result);
      tx.onerror = () => reject(tx.error);
    } catch (error) {
      reject(error);
    }
  });
};

// --- Memories Operations ---

export const getAllMemories = async (): Promise<Memory[]> => {
  // Try Firebase first, fallback to IndexedDB
  if (isFirebaseReady()) {
    try {
      const firebaseData = await firebaseSync.get('memories');
      if (firebaseData) {
        const memories = Object.values(firebaseData) as Memory[];
        // Also save to IndexedDB for offline access
        await Promise.all(memories.map(m => 
          performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.put(m))
        ));
        return memories;
      }
    } catch (error) {
      console.error('Firebase getAllMemories error:', error);
    }
  }
  // Fallback to IndexedDB
  return performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll());
};

export const saveMemory = async (memory: Memory): Promise<IDBValidKey> => {
  // Save to IndexedDB first (fast, local)
  const result = await performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.put(memory));
  
  // Sync to Firebase (for cross-device sync)
  if (isFirebaseReady()) {
    try {
      const allMemories = await performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll()) as Memory[];
      const memoriesObj: Record<string, Memory> = {};
      allMemories.forEach(m => {
        memoriesObj[m.id] = m;
      });
      console.log('💾 Syncing memories to Firebase:', Object.keys(memoriesObj).length, 'memories');
      await firebaseSync.save('memories', memoriesObj);
      console.log('✅ Memories synced to Firebase successfully');
    } catch (error) {
      console.error('❌ Firebase saveMemory sync error:', error);
    }
  }
  
  return result;
};

export const deleteMemory = async (id: string): Promise<void> => {
  // Delete from IndexedDB first
  await performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.delete(id));
  
  // Sync to Firebase
  if (isFirebaseReady()) {
    try {
      const allMemories = await performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll()) as Memory[];
      const memoriesObj: Record<string, Memory> = {};
      allMemories.forEach(m => {
        memoriesObj[m.id] = m;
      });
      await firebaseSync.save('memories', memoriesObj);
    } catch (error) {
      console.error('Firebase deleteMemory sync error:', error);
    }
  }
};

// --- Todo Operations ---

export const getAllTodos = async (): Promise<TodoItem[]> => {
  // Try Firebase first, fallback to IndexedDB
  if (isFirebaseReady()) {
    try {
      const firebaseData = await firebaseSync.get('todos');
      if (firebaseData) {
        const todos = Object.values(firebaseData) as TodoItem[];
        // Also save to IndexedDB for offline access
        await Promise.all(todos.map(t => 
          performTransaction(STORE_TODOS, 'readwrite', (store) => store.put(t))
        ));
        return todos;
      }
    } catch (error) {
      console.error('Firebase getAllTodos error:', error);
    }
  }
  // Fallback to IndexedDB
  return performTransaction(STORE_TODOS, 'readonly', (store) => store.getAll());
};

export const saveTodo = async (todo: TodoItem): Promise<IDBValidKey> => {
  // Save to IndexedDB first (fast, local)
  const result = await performTransaction(STORE_TODOS, 'readwrite', (store) => store.put(todo));
  
  // Sync to Firebase (for cross-device sync)
  if (isFirebaseReady()) {
    try {
      const allTodos = await performTransaction(STORE_TODOS, 'readonly', (store) => store.getAll()) as TodoItem[];
      const todosObj: Record<string, TodoItem> = {};
      allTodos.forEach(t => {
        todosObj[t.id] = t;
      });
      await firebaseSync.save('todos', todosObj);
    } catch (error) {
      console.error('Firebase saveTodo sync error:', error);
    }
  }
  
  return result;
};

export const deleteTodo = async (id: string): Promise<void> => {
  // Delete from IndexedDB first
  await performTransaction(STORE_TODOS, 'readwrite', (store) => store.delete(id));
  
  // Sync to Firebase
  if (isFirebaseReady()) {
    try {
      const allTodos = await performTransaction(STORE_TODOS, 'readonly', (store) => store.getAll()) as TodoItem[];
      const todosObj: Record<string, TodoItem> = {};
      allTodos.forEach(t => {
        todosObj[t.id] = t;
      });
      await firebaseSync.save('todos', todosObj);
    } catch (error) {
      console.error('Firebase deleteTodo sync error:', error);
    }
  }
};

// --- Settings/Avatar Operations ---

export const getSetting = async (key: string): Promise<any> => {
  // Try Firebase first
  if (isFirebaseReady()) {
    try {
      const firebaseData = await firebaseSync.get(`settings/${key}`);
      if (firebaseData !== null) {
        // Also save to IndexedDB
        await performTransaction(STORE_SETTINGS, 'readwrite', (store) => store.put({ key, value: firebaseData }));
        return { key, value: firebaseData };
      }
    } catch (error) {
      console.error('Firebase getSetting error:', error);
    }
  }
  // Fallback to IndexedDB
  return performTransaction(STORE_SETTINGS, 'readonly', (store) => store.get(key));
};

export const saveSetting = async (key: string, value: any): Promise<IDBValidKey> => {
  // Save to IndexedDB first
  const result = await performTransaction(STORE_SETTINGS, 'readwrite', (store) => store.put({ key, value }));
  
  // Sync to Firebase
  if (isFirebaseReady()) {
    try {
      await firebaseSync.save(`settings/${key}`, value);
    } catch (error) {
      console.error('Firebase saveSetting sync error:', error);
    }
  }
  
  return result;
};

// Real-time sync listeners
export const setupRealtimeSync = (
  onMemoriesChange: (memories: Memory[]) => void,
  onTodosChange: (todos: TodoItem[]) => void
): (() => void) => {
  if (!isFirebaseReady()) {
    console.warn('Firebase not ready, skipping real-time sync setup');
    return () => {}; // Return no-op if Firebase not ready
  }

  const unsubscribers: (() => void)[] = [];

  // Listen to memories changes
  const unsubMemories = firebaseSync.listen('memories', (data) => {
    console.log('📥 Real-time sync: memories updated', data ? Object.keys(data).length + ' items' : 'empty');
    if (data && typeof data === 'object') {
      const memories = Object.values(data) as Memory[];
      console.log('🔄 Updating memories from Firebase:', memories.length);
      onMemoriesChange(memories);
      // Also update IndexedDB
      Promise.all(memories.map(m => 
        performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.put(m))
      )).catch(console.error);
    } else if (data === null) {
      // Empty data - clear memories
      console.log('🔄 Clearing memories (Firebase empty)');
      onMemoriesChange([]);
    }
  });
  unsubscribers.push(unsubMemories);

  // Listen to todos changes
  const unsubTodos = firebaseSync.listen('todos', (data) => {
    console.log('📥 Real-time sync: todos updated', data ? Object.keys(data).length + ' items' : 'empty');
    if (data && typeof data === 'object') {
      const todos = Object.values(data) as TodoItem[];
      console.log('🔄 Updating todos from Firebase:', todos.length);
      onTodosChange(todos);
      // Also update IndexedDB
      Promise.all(todos.map(t => 
        performTransaction(STORE_TODOS, 'readwrite', (store) => store.put(t))
      )).catch(console.error);
    } else if (data === null) {
      // Empty data - clear todos
      console.log('🔄 Clearing todos (Firebase empty)');
      onTodosChange([]);
    }
  });
  unsubscribers.push(unsubTodos);

  console.log('✅ Real-time sync listeners set up');
  
  // Return cleanup function
  return () => {
    console.log('🧹 Cleaning up real-time sync listeners');
    unsubscribers.forEach(unsub => unsub());
  };
};
