import { Memory, TodoItem } from '../types';
import { initFirebase, firebaseSync, firebaseStorage, isFirebaseReady } from './firebase';

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
  // Firebase is the source of truth - always use it if available
  if (isFirebaseReady()) {
    try {
      const firebaseData = await firebaseSync.get('memories');
      if (firebaseData && Object.keys(firebaseData).length > 0) {
        const firebaseMemories = Object.values(firebaseData) as Memory[];
        console.log('📥 Loaded from Firebase:', firebaseMemories.length, 'memories');
        
        // Get local memories to check for base64 versions (for offline viewing)
        const localMemories = await performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll()) as Memory[];
        const localMap = new Map(localMemories.map(m => [m.id, m]));
        
        // Use Firebase as source of truth, but enhance with local base64 if available
        const enhancedMemories = firebaseMemories.map(fbMemory => {
          const localMemory = localMap.get(fbMemory.id);
          // If we have local base64, use it for better offline experience
          // But keep Firebase metadata (caption, date) as source of truth
          if (localMemory && localMemory.url.startsWith('data:')) {
            return {
              ...fbMemory, // Use Firebase data as base (caption, date might be updated)
              url: localMemory.url // But use local base64 for offline viewing
            };
          }
          return fbMemory; // Use Firebase version (has Storage URL)
        });
        
        // Save Firebase data to IndexedDB (replace local with Firebase version)
        await Promise.all(enhancedMemories.map(m => 
          performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.put(m))
        ));
        
        // Remove any local memories that don't exist in Firebase (they were deleted)
        const firebaseIds = new Set(firebaseMemories.map(m => m.id));
        const localOnlyMemories = localMemories.filter(m => !firebaseIds.has(m.id));
        if (localOnlyMemories.length > 0) {
          console.log('🗑️ Removing local-only memories (deleted on other device):', localOnlyMemories.length);
          await Promise.all(localOnlyMemories.map(m => 
            performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.delete(m.id))
          ));
        }
        
        return enhancedMemories;
      } else {
        // Firebase is empty - clear local data too (everything was deleted)
        console.log('📭 Firebase is empty, clearing local memories');
        const localMemories = await performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll()) as Memory[];
        await Promise.all(localMemories.map(m => 
          performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.delete(m.id))
        ));
        return [];
      }
    } catch (error) {
      console.error('Firebase getAllMemories error:', error);
    }
  }
  // Fallback to IndexedDB only if Firebase not available
  return performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll());
};

export const saveMemory = async (memory: Memory): Promise<IDBValidKey> => {
  // Save to IndexedDB first (fast, local) - keep base64 for offline access
  const result = await performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.put(memory));
  
  // Sync to Firebase (for cross-device sync)
  if (isFirebaseReady()) {
    try {
      // Check if URL is base64 (large file) - if so, upload to Storage first
      let memoryForFirebase = { ...memory };
      
      if (memory.url.startsWith('data:')) {
        // Large base64 file - upload to Firebase Storage
        console.log('📤 Uploading large file to Firebase Storage:', memory.id);
        const storageUrl = await firebaseStorage.uploadMedia(memory.url, memory.id, memory.type);
        
        if (storageUrl) {
          // Use Storage URL for Firebase sync (much smaller)
          memoryForFirebase = { ...memory, url: storageUrl };
          console.log('✅ File uploaded to Storage, using URL for sync');
        } else {
          console.warn('⚠️ Storage upload failed, skipping Firebase sync for this memory');
          if ((window as any).__setIsSaving) {
            (window as any).__setIsSaving(false);
          }
          return result; // Skip Firebase sync if Storage upload fails
        }
      }
      
      // Get current Firebase state and merge (Firebase is source of truth)
      const firebaseData = await firebaseSync.get('memories');
      const memoriesObj: Record<string, Memory> = firebaseData || {};
      
      // Add/update this memory in Firebase
      memoriesObj[memory.id] = memoryForFirebase;
      
      console.log('💾 Syncing memory to Firebase:', memory.id, Object.keys(memoriesObj).length, 'total memories');
      await firebaseSync.save('memories', memoriesObj);
      console.log('✅ Memory synced to Firebase successfully');
    } catch (error) {
      console.error('❌ Firebase saveMemory sync error:', error);
    }
  }
  
  return result;
};

export const deleteMemory = async (id: string): Promise<void> => {
  // Delete from IndexedDB first
  await performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.delete(id));
  
  // Sync deletion to Firebase immediately
  if (isFirebaseReady()) {
    try {
      // Get current Firebase data
      const firebaseData = await firebaseSync.get('memories');
      const memoriesObj: Record<string, Memory> = firebaseData || {};
      
      // Remove the deleted memory
      delete memoriesObj[id];
      
      console.log('🗑️ Deleting memory from Firebase:', id);
      // Save updated list to Firebase
      await firebaseSync.save('memories', memoriesObj);
      console.log('✅ Memory deleted from Firebase');
    } catch (error) {
      console.error('❌ Firebase deleteMemory sync error:', error);
    }
  }
};

// --- Todo Operations ---

export const getAllTodos = async (): Promise<TodoItem[]> => {
  // Firebase is the source of truth - always use it if available
  if (isFirebaseReady()) {
    try {
      const firebaseData = await firebaseSync.get('todos');
      if (firebaseData && Object.keys(firebaseData).length > 0) {
        const firebaseTodos = Object.values(firebaseData) as TodoItem[];
        console.log('📥 Loaded from Firebase:', firebaseTodos.length, 'todos');
        
        // Save Firebase data to IndexedDB (replace local with Firebase version)
        await Promise.all(firebaseTodos.map(t => 
          performTransaction(STORE_TODOS, 'readwrite', (store) => store.put(t))
        ));
        
        // Remove any local todos that don't exist in Firebase (they were deleted)
        const localTodos = await performTransaction(STORE_TODOS, 'readonly', (store) => store.getAll()) as TodoItem[];
        const firebaseIds = new Set(firebaseTodos.map(t => t.id));
        const localOnlyTodos = localTodos.filter(t => !firebaseIds.has(t.id));
        if (localOnlyTodos.length > 0) {
          console.log('🗑️ Removing local-only todos (deleted on other device):', localOnlyTodos.length);
          await Promise.all(localOnlyTodos.map(t => 
            performTransaction(STORE_TODOS, 'readwrite', (store) => store.delete(t.id))
          ));
        }
        
        return firebaseTodos;
      } else {
        // Firebase is empty - clear local data too (everything was deleted)
        console.log('📭 Firebase is empty, clearing local todos');
        const localTodos = await performTransaction(STORE_TODOS, 'readonly', (store) => store.getAll()) as TodoItem[];
        await Promise.all(localTodos.map(t => 
          performTransaction(STORE_TODOS, 'readwrite', (store) => store.delete(t.id))
        ));
        return [];
      }
    } catch (error) {
      console.error('Firebase getAllTodos error:', error);
    }
  }
  // Fallback to IndexedDB only if Firebase not available
  return performTransaction(STORE_TODOS, 'readonly', (store) => store.getAll());
};

export const saveTodo = async (todo: TodoItem): Promise<IDBValidKey> => {
  // Save to IndexedDB first (fast, local)
  const result = await performTransaction(STORE_TODOS, 'readwrite', (store) => store.put(todo));
  
  // Sync to Firebase (for cross-device sync)
  if (isFirebaseReady()) {
    try {
      // Get current Firebase state and merge (Firebase is source of truth)
      const firebaseData = await firebaseSync.get('todos');
      const todosObj: Record<string, TodoItem> = firebaseData || {};
      
      // Add/update this todo in Firebase
      todosObj[todo.id] = todo;
      
      console.log('💾 Syncing todo to Firebase:', todo.id, Object.keys(todosObj).length, 'total todos');
      await firebaseSync.save('todos', todosObj);
      console.log('✅ Todo synced to Firebase successfully');
    } catch (error) {
      console.error('❌ Firebase saveTodo sync error:', error);
    }
  }
  
  return result;
};

export const deleteTodo = async (id: string): Promise<void> => {
  // Delete from IndexedDB first
  await performTransaction(STORE_TODOS, 'readwrite', (store) => store.delete(id));
  
  // Sync deletion to Firebase immediately
  if (isFirebaseReady()) {
    try {
      // Get current Firebase data
      const firebaseData = await firebaseSync.get('todos');
      const todosObj: Record<string, TodoItem> = firebaseData || {};
      
      // Remove the deleted todo
      delete todosObj[id];
      
      console.log('🗑️ Deleting todo from Firebase:', id);
      // Save updated list to Firebase
      await firebaseSync.save('todos', todosObj);
      console.log('✅ Todo deleted from Firebase');
    } catch (error) {
      console.error('❌ Firebase deleteTodo sync error:', error);
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
  const unsubMemories = firebaseSync.listen('memories', async (data) => {
    console.log('📥 Real-time sync: memories updated', data ? Object.keys(data).length + ' items' : 'empty');
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      const firebaseMemories = Object.values(data) as Memory[];
      const firebaseIds = new Set(firebaseMemories.map(m => m.id));
      
      // Get local memories for base64 enhancement
      const localMemories = await performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll()) as Memory[];
      const localMap = new Map(localMemories.map(m => [m.id, m]));
      
      // Use Firebase as source of truth, enhance with local base64
      const enhancedMemories = firebaseMemories.map(fbMemory => {
        const localMemory = localMap.get(fbMemory.id);
        if (localMemory && localMemory.url.startsWith('data:')) {
          return { ...fbMemory, url: localMemory.url };
        }
        return fbMemory;
      });
      
      // Remove local memories that don't exist in Firebase (deleted elsewhere)
      const toDelete = localMemories.filter(m => !firebaseIds.has(m.id));
      if (toDelete.length > 0) {
        console.log('🗑️ Removing deleted memories:', toDelete.length);
        await Promise.all(toDelete.map(m => 
          performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.delete(m.id))
        ));
      }
      
      // Update IndexedDB with Firebase data
      await Promise.all(enhancedMemories.map(m => 
        performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.put(m))
      ));
      
      console.log('🔄 Updating memories from Firebase:', enhancedMemories.length);
      // Always update - the callback will deduplicate by ID
      onMemoriesChange(enhancedMemories);
    } else {
      // Empty data - clear all memories
      console.log('🔄 Clearing all memories (Firebase empty)');
      const localMemories = await performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll()) as Memory[];
      await Promise.all(localMemories.map(m => 
        performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.delete(m.id))
      ));
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
