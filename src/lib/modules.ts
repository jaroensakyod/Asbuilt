// Side-effect imports of every module data file, so their collections and seeds
// are registered before a company loads (hydration) and before demo seeding.
import "@/lib/billing";
import "@/lib/hr/store";
import "@/lib/sales";
import "@/lib/procurement";
import "@/lib/accounting/store";
// phases 8–14 (each index.ts registers collections, provideSeed() and registerNotes())
import "@/lib/schedule";
import "@/lib/contracts";
import "@/lib/engineering";
import "@/lib/safety";
import "@/lib/plant";
import "@/lib/design";
import "@/lib/interior";
import "@/lib/field";
import "@/lib/tender";
