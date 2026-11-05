// Pure payroll / tax arithmetic. No imports on purpose: this file is unit-tested
// directly with `node --test --experimental-strip-types tests/hr/*.test.ts`.

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- social security (ประกันสังคม มาตรา 33) ----------

export type SsoSettings = {
  /** employee rate, 0.05 = 5% */
  rate: number;
  /** employer rate (matches the employee rate by law today) */
  employerRate: number;
  /** minimum wage base per month */
  floor: number;
  /** maximum wage base per month (scheduled to rise, keep configurable) */
  ceiling: number;
};

export const DEFAULT_SSO: SsoSettings = { rate: 0.05, employerRate: 0.05, floor: 1650, ceiling: 15000 };

/** Highest monthly contribution for one side (employee or employer). */
export const ssoMonthlyMax = (s: SsoSettings = DEFAULT_SSO, employer = false) => Math.round(s.ceiling * (employer ? s.employerRate : s.rate));

/** Wage base used for the contribution: clamped to [floor, ceiling]. 0 when nothing was paid. */
export function ssoWageBase(wage: number, s: SsoSettings = DEFAULT_SSO) {
  if (wage <= 0) return 0;
  return Math.min(Math.max(wage, s.floor), s.ceiling);
}

/** Monthly contribution, rounded to whole baht (half a baht and up rounds up). */
export function ssoMonthly(wage: number, s: SsoSettings = DEFAULT_SSO, employer = false) {
  return Math.round(ssoWageBase(wage, s) * (employer ? s.employerRate : s.rate));
}

/**
 * Contribution for a partial pay period (weekly / semi-monthly daily-wage run).
 * 5% of the wage of this run, but never more than what is left of the monthly cap
 * after `alreadyThisMonth` was deducted in earlier runs of the same month.
 */
export function ssoPartial(wage: number, alreadyThisMonth = 0, s: SsoSettings = DEFAULT_SSO, employer = false) {
  if (wage <= 0) return 0;
  const left = Math.max(0, ssoMonthlyMax(s, employer) - alreadyThisMonth);
  return Math.min(Math.round(wage * (employer ? s.employerRate : s.rate)), left);
}

// ---------- personal income tax (ภ.ง.ด.1, annualised) ----------

/** [upper bound of the bracket, rate] on net taxable income */
export const PIT_BRACKETS: [number, number][] = [
  [150_000, 0],
  [300_000, 0.05],
  [500_000, 0.1],
  [750_000, 0.15],
  [1_000_000, 0.2],
  [2_000_000, 0.25],
  [5_000_000, 0.3],
  [Infinity, 0.35],
];

export function progressiveTax(taxable: number) {
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of PIT_BRACKETS) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return round2(tax);
}

export type TaxAllowances = {
  /** spouse without income */
  spouse: boolean;
  /** children, 30,000 each */
  children: number;
  /** 2nd and later children born 2018 or later, 60,000 each */
  childrenExtra: number;
  /** parents aged 60+ with low income, 30,000 each (max 4) */
  parents: number;
  /** life insurance premium paid per year */
  lifeInsurance: number;
  /** own health insurance premium per year */
  healthInsurance: number;
  /** provident fund contribution per year */
  providentFund: number;
  /** home loan interest per year */
  homeLoanInterest: number;
  /** other allowances already capped by the user (donations, RMF/SSF …) */
  other: number;
};

export const NO_ALLOWANCES: TaxAllowances = { spouse: false, children: 0, childrenExtra: 0, parents: 0, lifeInsurance: 0, healthInsurance: 0, providentFund: 0, homeLoanInterest: 0, other: 0 };

export const LIMITS = {
  personal: 60_000,
  spouse: 60_000,
  child: 30_000,
  childExtra: 60_000,
  parent: 30_000,
  lifeInsurance: 100_000,
  healthInsurance: 25_000,
  lifePlusHealth: 100_000,
  providentFundRate: 0.15,
  providentFund: 500_000,
  homeLoanInterest: 100_000,
  expenseRate: 0.5,
  expenseMax: 100_000,
};

export const expenseDeduction = (annualIncome: number) => Math.min(Math.max(0, annualIncome) * LIMITS.expenseRate, LIMITS.expenseMax);

/** Sum of allowances with legal caps applied. `annualSso` = employee SSO actually paid in the year. */
export function allowanceTotal(a: TaxAllowances, annualSso: number, annualIncome: number) {
  const life = Math.min(a.lifeInsurance, LIMITS.lifeInsurance);
  const health = Math.min(a.healthInsurance, LIMITS.healthInsurance);
  const lifeHealth = Math.min(life + health, LIMITS.lifePlusHealth);
  const pvd = Math.min(a.providentFund, annualIncome * LIMITS.providentFundRate, LIMITS.providentFund);
  return (
    LIMITS.personal +
    (a.spouse ? LIMITS.spouse : 0) +
    a.children * LIMITS.child +
    a.childrenExtra * LIMITS.childExtra +
    Math.min(a.parents, 4) * LIMITS.parent +
    Math.max(0, annualSso) +
    lifeHealth +
    pvd +
    Math.min(a.homeLoanInterest, LIMITS.homeLoanInterest) +
    Math.max(0, a.other)
  );
}

export type AnnualTax = { income: number; expense: number; allowances: number; taxable: number; tax: number };

export function annualPit(annualIncome: number, a: TaxAllowances = NO_ALLOWANCES, annualSso = 0): AnnualTax {
  const expense = expenseDeduction(annualIncome);
  const allowances = allowanceTotal(a, annualSso, annualIncome);
  const taxable = Math.max(0, annualIncome - expense - allowances);
  return { income: annualIncome, expense, allowances, taxable, tax: progressiveTax(taxable) };
}

/**
 * Monthly withholding by the annualised method: estimate the year's income as
 * this month's taxable pay × 12, compute the annual tax, withhold 1/12.
 */
export function monthlyWht(monthlyIncome: number, a: TaxAllowances = NO_ALLOWANCES, monthlySso = 0) {
  if (monthlyIncome <= 0) return 0;
  return round2(annualPit(monthlyIncome * 12, a, monthlySso * 12).tax / 12);
}

// ---------- wages ----------

export const OT_MULTIPLIER = 1.5;
export const HOURS_PER_DAY = 8;
/** Monthly staff: hourly rate = salary / 30 / 8 (Labour Protection Act s.68) */
export const monthlyHourly = (salary: number) => salary / 30 / HOURS_PER_DAY;
export const otPayMonthly = (salary: number, hours: number) => round2(monthlyHourly(salary) * OT_MULTIPLIER * hours);

export type DayMark = "present" | "half" | "absent";
export const DAY_VALUE: Record<DayMark, number> = { present: 1, half: 0.5, absent: 0 };

/** Daily-wage pay: days × rate + OT hours × (rate / 8) × 1.5 */
export function dailyWage(days: number, rate: number, otHours = 0) {
  const base = round2(days * rate);
  const ot = round2(otHours * (rate / HOURS_PER_DAY) * OT_MULTIPLIER);
  return { base, ot, gross: round2(base + ot) };
}
