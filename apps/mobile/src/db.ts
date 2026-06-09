import * as SQLite from "expo-sqlite";
import type { MeetingResult } from "./types";

/**
 * On-device history. Meetings never leave the phone except to be processed;
 * the stored result lives only here. The whole MeetingResult is kept as JSON
 * (the structure is small and we always render the whole thing).
 *
 * SQLite is the real store on native. On web (or if SQLite fails to init for
 * any reason) we fall back to an in-memory store so the app never crashes —
 * history just doesn't persist across reloads there. The exported API is the
 * same either way.
 */

export interface MeetingRow {
  id: string;
  title: string | null;
  createdAt: string;
  result: MeetingResult;
}

interface Store {
  save(result: MeetingResult): Promise<void>;
  list(): Promise<MeetingRow[]>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

// --- In-memory fallback ------------------------------------------------------

function memoryStore(): Store {
  let rows: MeetingRow[] = [];
  return {
    async save(result) {
      rows = rows.filter((r) => r.id !== result.id);
      rows.unshift({
        id: result.id,
        title: result.meta?.title ?? null,
        createdAt: result.createdAt,
        result,
      });
    },
    async list() {
      return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async remove(id) {
      rows = rows.filter((r) => r.id !== id);
    },
    async clear() {
      rows = [];
    },
  };
}

// --- SQLite store ------------------------------------------------------------

function sqliteStore(db: SQLite.SQLiteDatabase): Store {
  return {
    async save(result) {
      await db.runAsync(
        "INSERT OR REPLACE INTO meetings (id, title, createdAt, result) VALUES (?, ?, ?, ?)",
        result.id,
        result.meta?.title ?? null,
        result.createdAt,
        JSON.stringify(result),
      );
    },
    async list() {
      const rows = await db.getAllAsync<{
        id: string;
        title: string | null;
        createdAt: string;
        result: string;
      }>("SELECT id, title, createdAt, result FROM meetings ORDER BY createdAt DESC");
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: r.createdAt,
        result: JSON.parse(r.result) as MeetingResult,
      }));
    },
    async remove(id) {
      await db.runAsync("DELETE FROM meetings WHERE id = ?", id);
    },
    async clear() {
      await db.runAsync("DELETE FROM meetings");
    },
  };
}

// --- Lazy init with graceful fallback ---------------------------------------

let storePromise: Promise<Store> | null = null;

function store(): Promise<Store> {
  if (!storePromise) {
    storePromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync("thinkmate.db");
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS meetings (
            id        TEXT PRIMARY KEY NOT NULL,
            title     TEXT,
            createdAt TEXT NOT NULL,
            result    TEXT NOT NULL
          );
        `);
        return sqliteStore(db);
      } catch (err) {
        console.warn("SQLite unavailable, using in-memory history:", err);
        return memoryStore();
      }
    })();
  }
  return storePromise;
}

export async function saveMeeting(result: MeetingResult): Promise<void> {
  return (await store()).save(result);
}

export async function listMeetings(): Promise<MeetingRow[]> {
  return (await store()).list();
}

export async function deleteMeeting(id: string): Promise<void> {
  return (await store()).remove(id);
}

export async function clearAllMeetings(): Promise<void> {
  return (await store()).clear();
}
