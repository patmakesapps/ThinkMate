import * as SQLite from "expo-sqlite";
import type { MeetingResult } from "./types";

/**
 * On-device history. Meetings never leave the phone except to be processed;
 * the stored result lives only here. The whole MeetingResult is kept as JSON
 * (the structure is small and we always render the whole thing).
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("thinkmate.db").then(async (d) => {
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS meetings (
          id        TEXT PRIMARY KEY NOT NULL,
          title     TEXT,
          createdAt TEXT NOT NULL,
          result    TEXT NOT NULL
        );
      `);
      return d;
    });
  }
  return dbPromise;
}

export interface MeetingRow {
  id: string;
  title: string | null;
  createdAt: string;
  result: MeetingResult;
}

export async function saveMeeting(result: MeetingResult): Promise<void> {
  const d = await db();
  await d.runAsync(
    "INSERT OR REPLACE INTO meetings (id, title, createdAt, result) VALUES (?, ?, ?, ?)",
    result.id,
    result.meta?.title ?? null,
    result.createdAt,
    JSON.stringify(result),
  );
}

export async function listMeetings(): Promise<MeetingRow[]> {
  const d = await db();
  const rows = await d.getAllAsync<{
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
}

export async function deleteMeeting(id: string): Promise<void> {
  const d = await db();
  await d.runAsync("DELETE FROM meetings WHERE id = ?", id);
}

export async function clearAllMeetings(): Promise<void> {
  const d = await db();
  await d.runAsync("DELETE FROM meetings");
}
