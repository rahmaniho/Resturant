/* ============================================================
   لایه ذخیره‌سازی — IndexedDB
   ============================================================ */

export const DB_NAME = 'aftab-db';
export const DB_VERSION = 2;

/** تعریف استورها و ایندکس‌ها */
const SCHEMA = {
  categories: { indexes: { name: 'name' } },
  foods: { indexes: { categoryId: 'categoryId', name: 'name' } },
  ingredients: { indexes: { name: 'name' } },
  suppliers: { indexes: { name: 'name' } },
  purchases: { indexes: { date: 'date', supplierId: 'supplierId' } },
  recipes: { indexes: { foodId: 'foodId' } },
  sales: { indexes: { date: 'date', ts: 'ts' } },
  movements: { indexes: { ingredientId: 'ingredientId', date: 'date', type: 'type', refType: 'refType', refId: 'refId' } },
  expenses: { indexes: { date: 'date', uniqueKey: 'uniqueKey', category: 'category' } },
  expenseTemplates: {},
  cashEntries: { indexes: { date: 'date', type: 'type', refType: 'refType' } },
  counts: { indexes: { date: 'date' } },
  staff: { indexes: { name: 'name' } },
  history: { indexes: { at: 'at', entity: 'entity' } },
};

export const STORE_NAMES = Object.keys(SCHEMA);

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, def] of Object.entries(SCHEMA)) {
        let os;
        if (!db.objectStoreNames.contains(name)) {
          os = db.createObjectStore(name, { keyPath: 'id' });
        } else {
          os = e.target.transaction.objectStore(name);
        }
        for (const [idx, path] of Object.entries(def.indexes || {})) {
          if (!os.indexNames.contains(idx)) os.createIndex(idx, path, { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('دسترسی به پایگاه داده مسدود است؛ مرورگرهای دیگر این برنامه را ببندید.'));
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('تراکنش لغو شد'));
  });
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await openDB();
  return reqP(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await openDB();
  return reqP(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await txDone(tx);
  return value;
}

export async function putMany(store, values) {
  if (!values.length) return;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  await txDone(tx);
}

export async function del(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await txDone(tx);
}

export async function clearStore(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  await txDone(tx);
}

export async function clearAll() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  for (const s of STORE_NAMES) tx.objectStore(s).clear();
  await txDone(tx);
}

export async function count(store) {
  const db = await openDB();
  return reqP(db.transaction(store, 'readonly').objectStore(store).count());
}

export async function getByIndex(store, index, value) {
  const db = await openDB();
  return reqP(db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value));
}

/** چند خواندن موازی: await readAll({sales: [...], foods: [...]}) */
export async function readAll(stores) {
  const out = {};
  await Promise.all(Object.keys(stores).map(async (s) => { out[s] = await getAll(s); }));
  return out;
}

/** چند نوشتن در یک تراکنش */
export async function writeBatch(ops) {
  // ops: [{store, value}] یا [{store, delete: key}]
  const stores = [...new Set(ops.map((o) => o.store))];
  const db = await openDB();
  const tx = db.transaction(stores, 'readwrite');
  for (const op of ops) {
    if ('delete' in op) tx.objectStore(op.store).delete(op.delete);
    else tx.objectStore(op.store).put(op.value);
  }
  await txDone(tx);
}

/* ---------- تاریخچه تغییرات ---------- */

export async function logHistory({ entity, entityId, action, before = null, after = null, note = '' }) {
  try {
    await put('history', {
      id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ts: Date.now(),
      entity,
      entityId,
      action, // create | update | delete | import | restore | system
      before,
      after,
      note,
    });
  } catch (e) {
    console.warn('ثبت تاریخچه ناموفق بود', e);
  }
}

export async function getHistory(limit = 500) {
  const all = await getAll('history');
  return all.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export async function clearHistory() {
  await clearStore('history');
}
