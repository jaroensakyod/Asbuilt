// Asset candidates for the defect/repair photo assistant (house model registry of a project).
import { assetLocation, projectAssets } from "@/components/ops/seed";
import { getProject } from "@/lib/data";
import type { AssetCandidate } from "@/lib/ai-field/defect";

export function assetCandidates(projectId: string): AssetCandidate[] {
  const p = getProject(projectId);
  const { model, assets } = projectAssets(p);
  if (!model) return [];
  return assets.filter((a) => a.category !== "เบรกเกอร์ลูกย่อย").map((a) => ({ code: a.code, name: a.name, system: a.system, category: a.category, location: assetLocation(model, a) }));
}
