import { openDB } from "idb";
import { api } from "./api";

const DB_NAME = "jointcare-offline";
const STORE = "pending";

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId", autoIncrement: true });
      }
    },
  });
}

export async function queueOffline(type, payload) {
  const db = await getDB();
  await db.add(STORE, { type, payload, createdAt: new Date().toISOString() });
}

export async function getPending() {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function clearPending(localId) {
  const db = await getDB();
  await db.delete(STORE, localId);
}

export async function syncPending() {
  const items = await getPending();
  let synced = 0;
  for (const item of items) {
    try {
      if (item.type === "patient") {
        await api.post("/patients", item.payload);
      } else if (item.type === "screening") {
        await api.post("/screenings", item.payload);
      }
      await clearPending(item.localId);
      synced += 1;
    } catch (e) {
      // keep in queue if it still fails
    }
  }
  return synced;
}
