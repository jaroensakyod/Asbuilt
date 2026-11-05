// Collections for the labour records (skills, migrant documents, piece-rate, advances,
// camps, time-clock and labour-law settings). Registered at startup via src/lib/safety/index.ts.
import { createCollection } from "../collection";
import { DEFAULT_CLOCK } from "./clock";
import { DEFAULT_LABOUR } from "./labour";
import {
  seedAdvances,
  seedCampInspections,
  seedCampIssues,
  seedCampMeters,
  seedCamps,
  seedClockSettings,
  seedLabourSettings,
  seedMigrantDocs,
  seedPieceClaims,
  seedPieceContracts,
  seedSkills,
  seedTraining,
} from "./labour-seed";
import type { Advance, Camp, CampInspection, CampIssue, CampMeter, ClockSettings, LabourSettings, MigrantDoc, PieceRateClaim, PieceRateContract, TrainingRecord, WorkerSkills } from "./labour-types";

export const trainings = createCollection<TrainingRecord>("training_records", seedTraining);
export const workerSkills = createCollection<WorkerSkills>("worker_skills", seedSkills);
export const migrantDocs = createCollection<MigrantDoc>("migrant_docs", seedMigrantDocs);
export const pieceContracts = createCollection<PieceRateContract>("piece_rate_contracts", seedPieceContracts);
export const pieceClaims = createCollection<PieceRateClaim>("piece_rate_claims", seedPieceClaims);
export const advances = createCollection<Advance>("advances", seedAdvances);
export const camps = createCollection<Camp>("camps", seedCamps);
export const campMeters = createCollection<CampMeter>("camp_meters", seedCampMeters);
export const campInspections = createCollection<CampInspection>("camp_inspections", seedCampInspections);
export const campIssues = createCollection<CampIssue>("camp_issues", seedCampIssues);
export const labourSettings = createCollection<LabourSettings>("labour_settings", seedLabourSettings);
export const clockSettings = createCollection<ClockSettings>("clock_settings", seedClockSettings);

export const useLabourSettings = (): LabourSettings => labourSettings.use().find((s) => s.id === "labour-settings") ?? DEFAULT_LABOUR;
export const useClockSettings = (): ClockSettings => clockSettings.use().find((s) => s.id === "clock-settings") ?? DEFAULT_CLOCK;
export const getLabourSettings = (): LabourSettings => labourSettings.get("labour-settings") ?? DEFAULT_LABOUR;
