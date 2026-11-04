import type { HouseModel } from "@/lib/data";

export const priceRange = (m: Pick<HouseModel, "priceMin" | "priceMax">) => `฿${m.priceMin.toFixed(1)}–${m.priceMax.toFixed(1)} ล้าน`;
