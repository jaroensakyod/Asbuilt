// Module-level extension of the shared WbsTask (extra fields are optional, other modules can ignore them).
import type { WbsTask } from "../biz";

export type SchedTask = WbsTask & {
  /** a group row created empty in the editor (becomes a summary once it has children) */
  group?: boolean;
  /** "start no earlier than" constraint (status-date rescheduling of unstarted work) */
  notBefore?: string;
};
