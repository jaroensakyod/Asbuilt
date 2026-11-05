"use client";

// What the customer portal reads and the actions a customer can take.
//   demo mode → the module collections in this browser (same store functions staff use)
//   live mode → records returned by portal_view(token); actions go through portal_write(token, kind, record)

import { variations as variationsCol, type Variation } from "@/lib/biz";
import type { MediaRef } from "@/lib/media";
import { PORTAL_LIVE, portalWrite, recordsOf, type PortalRecord } from "@/lib/portal";
import { approveStage, designStages, nowIso, portalMessages, postMessage, requestStageChanges, saveSurvey, surveys } from "@/lib/design/store";
import type { DesignStage, PortalMessage, ReviewEntry, SurveyResponse } from "@/lib/design/types";
import { chooseOption, moodBoards, products, selections } from "@/lib/interior/store";
import type { MoodBoard, Product, Selection } from "@/lib/interior/types";
import { TODAY } from "@/lib/data";

export type PortalApi = {
  live: boolean;
  stages: DesignStage[];
  selections: Selection[];
  variations: Variation[];
  messages: PortalMessage[];
  surveys: SurveyResponse[];
  boards: MoodBoard[];
  products: Product[];
  approveStage: (s: DesignStage, name: string, comment?: string) => Promise<void>;
  requestChanges: (s: DesignStage, name: string, comment: string) => Promise<void>;
  choose: (s: Selection, optionId: string, name: string, note?: string) => Promise<void>;
  approveVariation: (v: Variation, name: string, signature: MediaRef) => Promise<void>;
  declineVariation: (v: Variation, name: string, reason: string) => Promise<void>;
  send: (text: string, name: string, files: MediaRef[]) => Promise<void>;
  survey: (r: SurveyResponse) => Promise<void>;
  commentBoard: (b: MoodBoard, comment: string, liked: boolean) => Promise<void>;
};

const review = (s: DesignStage, r: Omit<ReviewEntry, "id" | "at">): ReviewEntry[] => [...s.reviews, { ...r, id: `R-${Date.now().toString(36)}`, at: nowIso() }];

export function usePortalData(projectId: string, live?: { token: string; records: PortalRecord[]; reload: () => void }): PortalApi {
  // hooks always run (stable order); live mode ignores the browser collections
  const st = designStages.use();
  const sel = selections.use();
  const vos = variationsCol.use();
  const msgs = portalMessages.use();
  const srv = surveys.use();
  const brd = moodBoards.use();
  const prd = products.use();
  const mine = <T extends { projectId?: string }>(l: T[]) => l.filter((x) => x.projectId === projectId);

  if (PORTAL_LIVE && live) {
    const r = live.records;
    const write = async (kind: Parameters<typeof portalWrite>[1], rec: { id: string } & Record<string, unknown>) => {
      await portalWrite(live.token, kind, rec);
      live.reload();
    };
    const msg = (name: string, text: string, attachments?: MediaRef[]): PortalMessage => ({ id: `MSG-${projectId}-P${Date.now().toString(36)}`, projectId, side: "customer", author: name, text, at: nowIso(), attachments });
    return {
      live: true,
      stages: recordsOf<DesignStage>(r, "design_stages"),
      selections: recordsOf<Selection>(r, "selections"),
      variations: recordsOf<Variation>(r, "variations"),
      messages: recordsOf<PortalMessage>(r, "portal_messages"),
      surveys: recordsOf<SurveyResponse>(r, "satisfaction_surveys"),
      boards: recordsOf<MoodBoard>(r, "mood_boards").filter((b) => b.shared),
      products: recordsOf<Product>(r, "interior_products"),
      approveStage: (s, name, comment) => write("design_stages", { ...s, status: "approved", approvedAt: TODAY, approvedBy: name, finishedAt: TODAY, feeAuto: true, reviews: review(s, { by: name, side: "client", action: "approved", comment }) }),
      requestChanges: (s, name, comment) => write("design_stages", { ...s, status: "changes_requested", revisions: s.revisions + 1, reviews: review(s, { by: name, side: "client", action: "changes", comment }) }),
      choose: (s, optionId, name, note) => write("selections", { ...s, chosenId: optionId, chosenAt: TODAY, chosenBy: name, clientNote: note || s.clientNote, status: "chosen" }),
      approveVariation: (v, name, signature) => write("variations", { ...v, status: "approved", approvedBy: name, approvedAt: TODAY, signature }),
      declineVariation: async (v, name, reason) => {
        await portalWrite(live.token, "variations", { ...v, status: "rejected", approvedBy: name, approvedAt: TODAY });
        await write("portal_messages", { ...msg(name, `ไม่อนุมัติงานเปลี่ยนแปลง ${v.id} ${v.title}: ${reason}`) });
      },
      send: (text, name, files) => write("portal_messages", { ...msg(name, text, files.length ? files : undefined) }),
      survey: (s) => write("satisfaction_surveys", { ...s }),
      commentBoard: (b, comment, liked) => write("mood_boards", { ...b, clientComment: comment || b.clientComment, clientCommentAt: TODAY, clientLiked: liked }),
    };
  }

  return {
    live: false,
    stages: mine(st),
    selections: mine(sel),
    variations: mine(vos),
    messages: mine(msgs),
    surveys: mine(srv),
    boards: mine(brd).filter((b) => b.shared),
    products: prd,
    approveStage: async (s, name, comment) => approveStage(s, name, "client", comment),
    requestChanges: async (s, name, comment) => requestStageChanges(s, name, "client", comment),
    choose: async (s, optionId, name, note) => chooseOption(s, optionId, name, note),
    approveVariation: async (v, name, signature) => variationsCol.upsert({ ...v, status: "approved", approvedBy: name, approvedAt: TODAY, signature }),
    declineVariation: async (v, name, reason) => {
      variationsCol.upsert({ ...v, status: "rejected", approvedBy: name, approvedAt: TODAY });
      postMessage(projectId, "customer", name, `ไม่อนุมัติงานเปลี่ยนแปลง ${v.id} ${v.title}: ${reason}`);
    },
    send: async (text, name, files) => void postMessage(projectId, "customer", name, text, files),
    survey: async (r) => saveSurvey(r),
    commentBoard: async (b, comment, liked) => moodBoards.upsert({ ...b, clientComment: comment || b.clientComment, clientCommentAt: TODAY, clientLiked: liked }),
  };
}
