/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LifeEvent {
  year: number;
  label: string;
  type: 'income_change' | 'expense_peak' | 'retirement' | 'milestone';
  impact?: number; // Optional impact on yearly balance
}

export interface IncomeSource {
  label: string;
  amount: number;
  currentAge: number;
  retirementAge: number;
  growthRate: number;
}

export interface ChildMilestone {
  childAge: number;
  adjustmentAmount: number;
  reason?: string;
}

export interface ChildExpenseConfig {
  label: string;
  birthYear: number;
  baseAmount: number;
  inflationRate: number;
  independenceAge: number;
  milestones: ChildMilestone[];
}

export interface CoupleMilestone {
  age: number;
  adjustmentAmount: number;
  reason?: string;
}

export interface CoupleExpenseConfig {
  baseAmount: number;
  inflationRate: number;
  deathAge: number;
  milestones: CoupleMilestone[];
}

export interface SimulationParams {
  currentAge: number;
  currentYear: number;
  targetLifeSpan: number;
  currentAssets: number;
  incomes: IncomeSource[];
  coupleExpenses: CoupleExpenseConfig;
  children: ChildExpenseConfig[];
  expectedReturn: number;
  investmentStopYear: number;
}

export interface YearlyData {
  year: number;
  age: number;
  income: number;
  expenses: number;
  investmentAmount: number; // Income - Expenses
  assetsStart: number;
  assetsEnd: number;
  returnAmount: number;
  isRetired: boolean;
  events: string[];
}

export interface SimulationResult {
  yearlyData: YearlyData[];
  depletionAge: number | null;
  requiredReturn: number;
  totalReturn: number;
  finalAssets: number;
}
