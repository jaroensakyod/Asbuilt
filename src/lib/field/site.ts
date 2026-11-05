// Phone app (/m) per-device choices: today's site and the technician whose jobs are shown.
// Kept in localStorage only (a device setting, not company data).

import { createLocalStore } from "@/lib/projects-store";

/** project id picked as "today's site" on the phone hub (shared by /m/diary, /m/issue, /m/punch, /m/clock …) */
export const mSite = createLocalStore<string>("asbuilt.m.site", "");
/** technician name for /m/jobs */
export const mTech = createLocalStore<string>("asbuilt.m.tech", "");
