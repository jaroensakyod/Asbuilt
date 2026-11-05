// Collections for the official price feeds (browser side).
//   price_feed_maps      price-book item ↔ MOC com_code (+ unit factor)            id = item code
//   price_feed_syncs     log of every sync / file import                           id = SYNC-…
//   price_feed_settings  provinces + months for the MOC sync (and the cron job)    id = "moc"

import { createCollection } from "../collection";

export type FeedMap = {
  id: string;
  itemCode: string;
  comCode: string;
  comName: string;
  comUnit?: string;
  /** our price per item unit = MOC price × factor */
  factor: number;
  by: "auto" | "ai" | "user";
  score?: number;
  updatedAt: string;
  by_name?: string;
};

export type FeedSync = {
  id: string;
  at: string;
  via: "api" | "file" | "cron";
  source?: "moc" | "cgd";
  provinces?: string[];
  from?: string;
  to?: string;
  file?: string;
  requests?: number;
  added: number;
  updated: number;
  errors: number;
  status: "ok" | "partial" | "failed";
  message?: string;
  by: string;
};

export type FeedSettings = { id: "moc"; provinces: string[]; monthsBack: number; cron?: boolean };

export const feedMaps = createCollection<FeedMap>("price_feed_maps", []);
export const feedSyncs = createCollection<FeedSync>("price_feed_syncs", []);
export const feedSettings = createCollection<FeedSettings>("price_feed_settings", []);

export const syncId = (at: string) => `SYNC-${at.replace(/\D/g, "").slice(0, 14)}`;
