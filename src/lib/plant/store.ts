// Plant & equipment collections.
import { createCollection } from "../collection";
import { DEFAULT_PLANT } from "./calc";
import { seedBookings, seedMaint, seedPlantCerts, seedPlants, seedPlantSettings, seedUsage } from "./seed";
import type { Plant, PlantBooking, PlantCert, PlantMaint, PlantSettings, PlantUsage } from "./types";

export const plants = createCollection<Plant>("plants", seedPlants);
export const plantBookings = createCollection<PlantBooking>("plant_bookings", seedBookings);
export const plantUsage = createCollection<PlantUsage>("plant_usage", seedUsage);
export const plantMaint = createCollection<PlantMaint>("plant_maintenance", seedMaint);
export const plantCerts = createCollection<PlantCert>("plant_certs", seedPlantCerts);
export const plantSettings = createCollection<PlantSettings>("plant_settings", seedPlantSettings);

export const usePlantSettings = (): PlantSettings => plantSettings.use().find((s) => s.id === "plant-settings") ?? DEFAULT_PLANT;
