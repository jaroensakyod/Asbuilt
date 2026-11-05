// Customer satisfaction (portal surveys). Pure: used by the executive dashboard and tested in tests/design.
//
//   import { satisfactionScore } from "@/lib/design/satisfaction";
//   const s = satisfactionScore(surveys.use());   // { avg: 4.54, count: 37, byAspect, low }

import { SURVEY_ASPECTS, type SurveyAspect, type SurveyResponse } from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Mean of the aspects a response scored (1–5), or undefined when it scored none */
export function responseAvg(r: Pick<SurveyResponse, "scores">): number | undefined {
  const v = SURVEY_ASPECTS.map((a) => r.scores[a]).filter((x): x is number => typeof x === "number" && x >= 1 && x <= 5);
  return v.length ? v.reduce((t, x) => t + x, 0) / v.length : undefined;
}

/** A response with any aspect at or below the threshold */
export const isLowScore = (r: Pick<SurveyResponse, "scores">, threshold = 2) =>
  SURVEY_ASPECTS.some((a) => typeof r.scores[a] === "number" && r.scores[a]! <= threshold);

export type SatisfactionScore = {
  /** average of per-response means, 0 when there are none (2 decimals) */
  avg: number;
  count: number;
  byAspect: Record<SurveyAspect, { avg: number; count: number }>;
  /** responses with a score ≤ 2 */
  low: number;
};

/**
 * Average satisfaction and number of responses.
 * Optional filters: `since` (ISO date, inclusive) and `trigger` (handover / repair).
 */
export function satisfactionScore(list: SurveyResponse[], opts: { since?: string; trigger?: SurveyResponse["trigger"] } = {}): SatisfactionScore {
  const rows = list.filter((r) => (!opts.since || r.at >= opts.since) && (!opts.trigger || r.trigger === opts.trigger));
  const means = rows.map(responseAvg).filter((x): x is number => x !== undefined);
  const byAspect = Object.fromEntries(
    SURVEY_ASPECTS.map((a) => {
      const v = rows.map((r) => r.scores[a]).filter((x): x is number => typeof x === "number" && x >= 1 && x <= 5);
      return [a, { avg: v.length ? r2(v.reduce((t, x) => t + x, 0) / v.length) : 0, count: v.length }];
    }),
  ) as SatisfactionScore["byAspect"];
  return {
    avg: means.length ? r2(means.reduce((t, x) => t + x, 0) / means.length) : 0,
    count: means.length,
    byAspect,
    low: rows.filter((r) => isLowScore(r)).length,
  };
}
