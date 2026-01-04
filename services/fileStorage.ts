import { AppState, Note } from '../types';

const DB_NAME = 'ai_journal_storage';
const STORE_NAME = 'handles';
const ROOT_HANDLE_KEY = 'root_directory';

export const STORAGE_DIR_NAME = 'ai_journal_data';
export const NOTES_DIR_NAME = 'notes';
export const META_FILE_NAME = 'meta.json';

export const supportsFileSystemAccess = () =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window && 'indexedDB' in window;

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const getStoredDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!supportsFileSystemAccess()) return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(ROOT_HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle) || null);
    request.onerror = () => reject(request.error);
  });
};

export const storeDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, ROOT_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearStoredDirectoryHandle = async (): Promise<void> => {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(ROOT_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

type PermissionMode = 'read' | 'readwrite';

type DirectoryHandleWithPermission = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: PermissionMode }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: PermissionMode }) => Promise<PermissionState>;
};

export const ensureDirectoryPermission = async (
  handle: FileSystemDirectoryHandle,
  mode: PermissionMode = 'readwrite'
): Promise<boolean> => {
  const permissionHandle = handle as DirectoryHandleWithPermission;
  if (!permissionHandle.queryPermission || !permissionHandle.requestPermission) return true;
  const permission = await permissionHandle.queryPermission({ mode });
  if (permission === 'granted') return true;
  if (permission === 'prompt') {
    const requested = await permissionHandle.requestPermission({ mode });
    return requested === 'granted';
  }
  return false;
};

export const pickRootDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!supportsFileSystemAccess()) return null;
  try {
    const picker = window as typeof window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };
    if (!picker.showDirectoryPicker) return null;
    return await picker.showDirectoryPicker();
  } catch (error: any) {
    if (error?.name === 'AbortError') return null;
    throw error;
  }
};

const getStorageDirectory = async (rootHandle: FileSystemDirectoryHandle) => {
  if (rootHandle.name === STORAGE_DIR_NAME) return rootHandle;
  return rootHandle.getDirectoryHandle(STORAGE_DIR_NAME, { create: true });
};

type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>;
};

const getStorageNotesDirectory = async (rootHandle: FileSystemDirectoryHandle) => {
  const storageDir = await getStorageDirectory(rootHandle);
  return storageDir.getDirectoryHandle(NOTES_DIR_NAME, { create: true });
};

const getEntries = (handle: FileSystemDirectoryHandle) => {
  const directory = handle as DirectoryHandleWithEntries;
  if (!directory.entries) {
    return [] as unknown as AsyncIterableIterator<[string, FileSystemHandle]>;
  }
  return directory.entries();
};

const toDateParts = (noteDate: string) => {
  const date = new Date(noteDate);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
};

const buildDateKey = (parts: { year: number; month: number; day: number }) =>
  `${parts.year}/${parts.month}/${parts.day}`;

const ensureNoteFileHandle = async (
  notesDir: FileSystemDirectoryHandle,
  parts: { year: number; month: number; day: number }
) => {
  const yearDir = await notesDir.getDirectoryHandle(String(parts.year), { create: true });
  const monthDir = await yearDir.getDirectoryHandle(String(parts.month), { create: true });
  return monthDir.getFileHandle(`${parts.day}.json`, { create: true });
};

const readJsonFile = async (fileHandle: FileSystemFileHandle) => {
  const file = await fileHandle.getFile();
  if (file.size === 0) return null;
  const text = await file.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
};

const listNoteFiles = async (notesDir: FileSystemDirectoryHandle) => {
  const files: Array<{
    key: string;
    fileHandle: FileSystemFileHandle;
    parentHandle: FileSystemDirectoryHandle;
    fileName: string;
  }> = [];

  for await (const [yearName, yearHandle] of getEntries(notesDir)) {
    if (yearHandle.kind !== 'directory') continue;
    for await (const [monthName, monthHandle] of getEntries(yearHandle)) {
      if (monthHandle.kind !== 'directory') continue;
      for await (const [fileName, fileHandle] of getEntries(monthHandle)) {
        if (fileHandle.kind !== 'file' || !fileName.endsWith('.json')) continue;
        const dayName = fileName.replace(/\.json$/i, '');
        const key = `${yearName}/${monthName}/${dayName}`;
        files.push({
          key,
          fileHandle: fileHandle as FileSystemFileHandle,
          parentHandle: monthHandle as FileSystemDirectoryHandle,
          fileName
        });
      }
    }
  }

  return files;
};

const lastSavedByDate = new Map<string, string>();
let lastSavedMeta = '';

export const readStateFromFile = async (rootHandle: FileSystemDirectoryHandle): Promise<unknown | null> => {
  const storageDir = await getStorageDirectory(rootHandle);
  const notesDir = await getStorageNotesDirectory(rootHandle);
  let meta: Record<string, unknown> = {};
  let hasData = false;

  try {
    const metaHandle = await storageDir.getFileHandle(META_FILE_NAME, { create: false });
    const metaContent = await readJsonFile(metaHandle);
    if (metaContent && typeof metaContent === 'object') {
      meta = metaContent as Record<string, unknown>;
      hasData = true;
    }
  } catch (error: any) {
    if (error?.name !== 'NotFoundError') {
      console.error('Failed to read meta file:', error);
    }
  }

  const noteFiles = await listNoteFiles(notesDir);
  const notes: Note[] = [];
  for (const file of noteFiles) {
    try {
      const content = await readJsonFile(file.fileHandle);
      if (Array.isArray(content)) {
        notes.push(...(content as Note[]));
        hasData = true;
      }
    } catch (error) {
      console.error('Failed to read note file:', file.key, error);
    }
  }

  if (!hasData) return null;
  return { ...meta, notes };
};

export const writeStateToFile = async (rootHandle: FileSystemDirectoryHandle, state: AppState) => {
  const storageDir = await getStorageDirectory(rootHandle);
  const notesDir = await getStorageNotesDirectory(rootHandle);

  const metaPayload = {
    cycleLength: state.cycleLength,
    language: state.language,
    goals: state.goals,
    summaries: state.summaries,
    version: state.version
  };
  const metaString = JSON.stringify(metaPayload, null, 2);
  if (metaString !== lastSavedMeta) {
    const metaHandle = await storageDir.getFileHandle(META_FILE_NAME, { create: true });
    const writable = await metaHandle.createWritable();
    await writable.write(metaString);
    await writable.close();
    lastSavedMeta = metaString;
  }

  const notesByDate = new Map<string, Note[]>();
  state.notes.forEach(note => {
    const parts = toDateParts(note.date);
    const key = buildDateKey(parts);
    const existing = notesByDate.get(key);
    if (existing) {
      existing.push(note);
    } else {
      notesByDate.set(key, [note]);
    }
  });

  const existingFiles = await listNoteFiles(notesDir);
  const existingKeys = new Set(existingFiles.map(file => file.key));
  const targetKeys = new Set(notesByDate.keys());

  for (const [key, notes] of notesByDate.entries()) {
    const [year, month, day] = key.split('/').map(Number);
    const fileHandle = await ensureNoteFileHandle(notesDir, { year, month, day });
    const fileContent = JSON.stringify(notes, null, 2);
    if (lastSavedByDate.get(key) === fileContent) continue;
    const writable = await fileHandle.createWritable();
    await writable.write(fileContent);
    await writable.close();
    lastSavedByDate.set(key, fileContent);
  }

  for (const file of existingFiles) {
    if (targetKeys.has(file.key)) continue;
    const parent = file.parentHandle as DirectoryHandleWithEntries;
    if (parent.removeEntry) {
      await parent.removeEntry(file.fileName);
    }
    lastSavedByDate.delete(file.key);
  }
};
