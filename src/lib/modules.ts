// Side-effect imports of every module data file, so their collections and seeds
// are registered before a company loads (hydration) and before demo seeding.
import "@/lib/billing";
import "@/lib/hr/store";
import "@/lib/sales";
import "@/lib/procurement";
import "@/lib/accounting/store";
