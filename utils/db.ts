import { Memory, TodoItem } from '../types';

const DB_NAME = 'LoveStoryDB';
const DB_VERSION = 1;
const STORE_MEMORIES = 'memories';
const STORE_TODOS = 'todos';
const STORE_SETTINGS = 'settings';

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

export const getAllMemories = (): Promise<Memory[]> => {
  return performTransaction(STORE_MEMORIES, 'readonly', (store) => store.getAll());
};

export const saveMemory = (memory: Memory): Promise<IDBValidKey> => {
  return performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.put(memory));
};

export const deleteMemory = (id: string): Promise<void> => {
  return performTransaction(STORE_MEMORIES, 'readwrite', (store) => store.delete(id));
};

// --- Todo Operations ---

export const getAllTodos = (): Promise<TodoItem[]> => {
  return performTransaction(STORE_TODOS, 'readonly', (store) => store.getAll());
};

export const saveTodo = (todo: TodoItem): Promise<IDBValidKey> => {
  return performTransaction(STORE_TODOS, 'readwrite', (store) => store.put(todo));
};

export const deleteTodo = (id: string): Promise<void> => {
  return performTransaction(STORE_TODOS, 'readwrite', (store) => store.delete(id));
};

// --- Settings/Avatar Operations ---

export const getSetting = (key: string): Promise<any> => {
  return performTransaction(STORE_SETTINGS, 'readonly', (store) => store.get(key));
};

export const saveSetting = (key: string, value: any): Promise<IDBValidKey> => {
  return performTransaction(STORE_SETTINGS, 'readwrite', (store) => store.put({ key, value }));
};
