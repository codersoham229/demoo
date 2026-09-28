"use client";

export type RecentTx = {
  hash: string;
  label: string;
  at: string;
};

const KEY = "sih26125.recentTx.v1";
const MAX = 8;

export function loadRecentTx(): RecentTx[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentTx[];
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentTx(tx: RecentTx): RecentTx[] {
  try {
    const list = [tx, ...loadRecentTx()].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  } catch {
    return [tx];
  }
}

export function clearRecentTx(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
