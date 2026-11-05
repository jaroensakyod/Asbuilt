// Engineering module collections + actions. Imported for side effects by ./index.ts.

import { createCollection } from "@/lib/collection";
import { TODAY } from "@/lib/data";
import { variations, type Variation } from "@/lib/biz";
import { DEFAULT_CONCRETE_RULE, DEFAULT_REBAR_SPEC, nextNo, pad } from "./calc";
import { DEFAULT_ITP, DEFAULT_LICENSE_RULES } from "./defaults";
import {
  seedCloseouts,
  seedConcreteTests,
  seedDocuments,
  seedInspectionRequests,
  seedLicensees,
  seedMeetings,
  seedNcrs,
  seedPileTests,
  seedProjectLicensing,
  seedRebarLots,
  seedRfis,
  seedSubmittals,
  seedSupervisionReports,
  seedSupervisorChanges,
  seedTransmittals,
} from "./seed";
import type {
  ActionItem,
  Closeout,
  ConcreteTest,
  ControlledDoc,
  EngSettings,
  InspectionRequest,
  ItpTemplate,
  Licensee,
  Meeting,
  Ncr,
  PileTest,
  ProjectLicensing,
  RebarLot,
  Rfi,
  Submittal,
  SupervisionReport,
  SupervisorChange,
  Transmittal,
} from "./types";

export const rfis = createCollection<Rfi>("eng_rfis", seedRfis);
export const submittals = createCollection<Submittal>("eng_submittals", seedSubmittals);
export const ncrs = createCollection<Ncr>("eng_ncrs", seedNcrs);
export const itpTemplates = createCollection<ItpTemplate>("eng_itp_templates", () => DEFAULT_ITP);
export const inspectionRequests = createCollection<InspectionRequest>("eng_inspection_requests", seedInspectionRequests);
export const concreteTests = createCollection<ConcreteTest>("eng_concrete_tests", seedConcreteTests);
export const rebarLots = createCollection<RebarLot>("eng_rebar_lots", seedRebarLots);
export const pileTests = createCollection<PileTest>("eng_pile_tests", seedPileTests);
export const supervisionReports = createCollection<SupervisionReport>("eng_supervision_reports", seedSupervisionReports);
export const supervisorChanges = createCollection<SupervisorChange>("eng_supervisor_changes", seedSupervisorChanges);
export const licensees = createCollection<Licensee>("eng_licensees", seedLicensees);
export const projectLicensing = createCollection<ProjectLicensing>("eng_project_licensing", seedProjectLicensing);

let docCache: ControlledDoc[] | null = null;
const docSeed = () => (docCache ??= seedDocuments());
export const controlledDocs = createCollection<ControlledDoc>("eng_documents", docSeed);
export const transmittals = createCollection<Transmittal>("eng_transmittals", () => seedTransmittals(docSeed()));

let mtgCache: ReturnType<typeof seedMeetings> | null = null;
const mtgSeed = () => (mtgCache ??= seedMeetings());
export const meetings = createCollection<Meeting>("eng_meetings", () => mtgSeed().meetings);
export const actionItems = createCollection<ActionItem>("eng_action_items", () => mtgSeed().actions);
export const closeouts = createCollection<Closeout>("eng_closeouts", seedCloseouts);

// ---------- settings ----------

export const ENG_DEFAULTS: EngSettings = {
  id: "eng",
  concrete: DEFAULT_CONCRETE_RULE,
  rebar: DEFAULT_REBAR_SPEC,
  rfiWarnDays: 2,
  ncrOpenDays: 14,
  licenseDays: 60,
  rules: DEFAULT_LICENSE_RULES,
};
const settingsCol = createCollection<EngSettings>("eng_settings", []);
export function useEngSettings(): EngSettings {
  const rows = settingsCol.use();
  const s = rows.find((r) => r.id === "eng");
  return s ? { ...ENG_DEFAULTS, ...s, concrete: { ...ENG_DEFAULTS.concrete, ...s.concrete }, rebar: { ...ENG_DEFAULTS.rebar, ...s.rebar } } : ENG_DEFAULTS;
}
export const saveEngSettings = (s: EngSettings) => settingsCol.upsert(s);

// ---------- numbering ----------

export const nextRfiId = (projectId: string) => {
  const no = nextNo(rfis.all(), projectId);
  return { id: `RFI-${projectId}-${pad(no)}`, no };
};
export const nextSeries = <T extends { projectId: string; no: number }>(rows: T[], prefix: string, projectId: string) => {
  const no = nextNo(rows, projectId);
  return { id: `${prefix}-${projectId}-${pad(no)}`, no };
};
/** for series without a `no` field (tests, lots …): RB-<projectId>-001 */
export const nextPlainId = (rows: { id: string; projectId: string }[], prefix: string, projectId: string) => {
  const head = `${prefix}-${projectId}-`;
  const max = rows.filter((r) => r.id.startsWith(head)).reduce((m, r) => Math.max(m, Number(r.id.slice(head.length)) || 0), 0);
  return `${head}${pad(max + 1)}`;
};

export const nowIso = () => new Date().toISOString();
export const msgId = () => `M${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ---------- cross-module: RFI → variation ----------

/** Create a draft change order (งานเปลี่ยนแปลง) in the contracts module from an RFI. */
export function createVariationFromRfi(rfi: Rfi, by: string): Variation {
  const existing = rfi.variationId ? variations.get(rfi.variationId) : undefined;
  if (existing) return existing;
  const mine = variations.all().filter((v) => v.projectId === rfi.projectId);
  const head = `VO-${rfi.projectId}-`;
  const maxN = variations
    .all()
    .filter((v) => v.id.startsWith(head))
    .reduce((m, v) => Math.max(m, Number(v.id.slice(head.length)) || 0), 0);
  const answer = [...rfi.thread].reverse().find((m) => m.official);
  const vo: Variation = {
    id: `${head}${maxN + 1}`,
    projectId: rfi.projectId,
    no: mine.length + 1,
    title: `จาก ${rfi.id} · ${rfi.subject}`,
    reason: [rfi.question, answer ? `คำตอบ: ${answer.text}` : ""].filter(Boolean).join("\n"),
    origin: "rfi",
    rfiId: rfi.id,
    lines: [],
    amount: 0,
    cost: 0,
    days: 0,
    status: "draft",
    raisedBy: by,
    raisedAt: TODAY,
    attachments: rfi.attachments.length ? rfi.attachments : undefined,
  };
  variations.upsert(vo);
  rfis.upsert({ ...rfi, variationId: vo.id });
  return vo;
}
