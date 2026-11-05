// Saved assistant conversations (collection "ai_chats"). Text only: attachments keep their
// name/size but not their bytes, and tool results are not stored. Each chat has an owner and
// the UI lists only the signed-in user's chats.

import { createCollection } from "@/lib/collection";
import type { ChatMsg } from "./prompt";

export type AiChat = {
  id: string; // CHAT-<base36 time>
  owner: string; // email (live) or demo persona email
  title: string;
  created: string; // ISO datetime
  updated: string;
  /** page the chat was started on */
  page?: string;
  messages: ChatMsg[];
};

export const aiChats = createCollection<AiChat>("ai_chats", []);

/** keep the newest chats per owner */
export const MAX_CHATS = 40;
export const MAX_MESSAGES = 80;

export const newChatId = () => `CHAT-${Date.now().toString(36).toUpperCase()}`;
export const newMsgId = () => `M${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export function saveChat(chat: AiChat) {
  aiChats.upsert({ ...chat, messages: chat.messages.slice(-MAX_MESSAGES) });
  const mine = aiChats
    .all()
    .filter((c) => c.owner === chat.owner)
    .sort((a, b) => b.updated.localeCompare(a.updated));
  for (const old of mine.slice(MAX_CHATS)) aiChats.remove(old.id);
}
