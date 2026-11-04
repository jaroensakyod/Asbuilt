// Demo seeds this module owns in the shared business collections (biz.ts).
// Imported for its side effect by ./index.ts (and src/lib/modules.ts).

import { provideSeed } from "../biz";
import { generate } from "./gen";

provideSeed("supplier_bills", () => generate().bills);
provideSeed("cost_entries", () => generate().costs);
