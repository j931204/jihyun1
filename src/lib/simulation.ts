import { SimulationParams, YearlyData, SimulationResult } from '../types';

export function runSimulation(params: SimulationParams): SimulationResult {
  const {
    currentAge,
    currentYear,
    targetLifeSpan,
    currentAssets,
    incomes,
    coupleExpenses,
    children,
    expectedReturn,
  } = params;

  const yearlyData: YearlyData[] = [];
  let currentAssetsValue = currentAssets;
  let depletionAge: number | null = null;

  // Track the running base amounts to handle milestones and inflation resets
  let currentCoupleBase = coupleExpenses.baseAmount;
  let childRunningBases = children.map(c => c.baseAmount);

  for (let age = currentAge; age <= targetLifeSpan; age++) {
    const year = currentYear + (age - currentAge);
    const yearsElapsed = age - currentAge;

    const events: string[] = [];

    // 1. Income Calculation
    let totalIncome = 0;
    if (year < params.investmentStopYear) {
      incomes.forEach(source => {
        const sourceAge = source.currentAge + (age - currentAge);
        if (sourceAge < source.retirementAge) {
          const sourceIncome = source.amount * Math.pow(1 + source.growthRate, yearsElapsed);
          totalIncome += sourceIncome;
        }
        if (sourceAge === source.retirementAge && sourceAge > source.currentAge) {
          events.push(`${source.label} 은퇴 (${sourceAge}세)`);
        }
      });
    } else if (year === params.investmentStopYear) {
      events.push(`투자 중단 시점 (${year}년)`);
    }

    // 2. Expense Calculation
    let totalExpenses = 0;

    // Couple Expenses
    if (age > currentAge) {
      currentCoupleBase *= (1 + coupleExpenses.inflationRate);
    }
    
    // Check for couple milestones
    const coupleMilestone = coupleExpenses.milestones?.find(m => m.age === age);
    if (coupleMilestone) {
      const inflatedAdjustment = coupleMilestone.adjustmentAmount * Math.pow(1 + coupleExpenses.inflationRate, yearsElapsed);
      currentCoupleBase += inflatedAdjustment;
      const reasonStr = coupleMilestone.reason ? ` (${coupleMilestone.reason})` : '';
      const typeStr = coupleMilestone.adjustmentAmount >= 0 ? "증액" : "감액";
      const adjStr = `${inflatedAdjustment >= 0 ? '+' : ''}${Math.round(inflatedAdjustment).toLocaleString()}만`;
      events.push(`부부 지출: ${age}세 ${typeStr}${reasonStr} [${adjStr}] (합계: ${Math.round(currentCoupleBase).toLocaleString()}만)`);
    }

    if (age < coupleExpenses.deathAge) {
      totalExpenses += currentCoupleBase;
    } else if (age === coupleExpenses.deathAge) {
      events.push('부부 사망 (지출 종료)');
    }

    // Children Expenses
    children.forEach((child, idx) => {
      const childAge = year - child.birthYear;
      
      if (childAge >= 0 && childAge < child.independenceAge) {
        // Apply inflation first if not first year
        if (age > currentAge) {
          childRunningBases[idx] *= (1 + child.inflationRate);
        }

        // Check for milestones (adds to the running base)
        const milestone = child.milestones.find(m => m.childAge === childAge);
        if (milestone) {
          const inflatedAdjustment = milestone.adjustmentAmount * Math.pow(1 + child.inflationRate, yearsElapsed);
          childRunningBases[idx] += inflatedAdjustment;
          const reasonStr = milestone.reason ? ` (${milestone.reason})` : '';
          const typeStr = milestone.adjustmentAmount >= 0 ? "증액" : "감액";
          const adjStr = `${inflatedAdjustment >= 0 ? '+' : ''}${Math.round(inflatedAdjustment).toLocaleString()}만`;
          events.push(`${child.label}: ${childAge}세 ${typeStr}${reasonStr} [${adjStr}] (합계: ${Math.round(childRunningBases[idx]).toLocaleString()}만)`);
        }

        // Subtract child expenses from balance logic is handled via totalExpenses
        totalExpenses += childRunningBases[idx];
      } else if (childAge === child.independenceAge) {
        events.push(`${child.label} 독립 (지출 종료)`);
      }
    });

    const assetsStart = currentAssetsValue;
    const investmentAmount = totalIncome - totalExpenses;
    const returnAmount = year < params.investmentStopYear ? assetsStart * (expectedReturn / 100) : 0;
    const assetsEnd = assetsStart + investmentAmount + returnAmount;

    yearlyData.push({
      year,
      age,
      income: totalIncome,
      expenses: totalExpenses,
      investmentAmount,
      assetsStart,
      assetsEnd,
      returnAmount,
      isRetired: incomes.every(s => age >= s.retirementAge),
      events
    });

    currentAssetsValue = assetsEnd;

    if (currentAssetsValue < 0 && depletionAge === null) {
      depletionAge = age;
    }
  }

  // Calculate Required Return
  let low = 0;
  let high = 50;
  let requiredReturn = 0;
  for (let i = 0; i < 20; i++) {
    let mid = (low + high) / 2;
    if (checkSurvival(params, mid)) {
      high = mid;
      requiredReturn = mid;
    } else {
      low = mid;
    }
  }

  return {
    yearlyData,
    depletionAge,
    requiredReturn,
    totalReturn: expectedReturn,
    finalAssets: currentAssetsValue
  };
}

function checkSurvival(params: SimulationParams, testReturn: number): boolean {
  let assets = params.currentAssets;
  let coupleBase = params.coupleExpenses.baseAmount;
  let childBases = params.children.map(c => c.baseAmount);

  for (let age = params.currentAge; age <= params.targetLifeSpan; age++) {
    const year = params.currentYear + (age - params.currentAge);
    const yearsElapsed = age - params.currentAge;
    
    let totalIncome = 0;
    if (year < params.investmentStopYear) {
      params.incomes.forEach(source => {
        const sourceAge = source.currentAge + (age - params.currentAge);
        if (sourceAge < source.retirementAge) {
          totalIncome += source.amount * Math.pow(1 + source.growthRate, yearsElapsed);
        }
      });
    }

    if (age > params.currentAge) {
      coupleBase *= (1 + params.coupleExpenses.inflationRate);
    }
    
    const coupleMilestone = params.coupleExpenses.milestones?.find(m => m.age === age);
    if (coupleMilestone) {
      const inflatedAdjustment = coupleMilestone.adjustmentAmount * Math.pow(1 + params.coupleExpenses.inflationRate, yearsElapsed);
      coupleBase += inflatedAdjustment;
    }

    let totalExpenses = age < params.coupleExpenses.deathAge ? coupleBase : 0;

    params.children.forEach((child, idx) => {
      const childAge = year - child.birthYear;
      if (childAge >= 0 && childAge < child.independenceAge) {
        if (age > params.currentAge) {
          childBases[idx] *= (1 + child.inflationRate);
        }
        const milestone = child.milestones.find(m => m.childAge === childAge);
        if (milestone) {
          const inflatedAdjustment = milestone.adjustmentAmount * Math.pow(1 + child.inflationRate, yearsElapsed);
          childBases[idx] += inflatedAdjustment;
        }
        totalExpenses += childBases[idx];
      }
    });

    const netFlow = totalIncome - totalExpenses;
    const currentReturn = year < params.investmentStopYear ? (1 + testReturn / 100) : 1;
    assets = (assets * currentReturn) + netFlow;
    if (assets < 0 && age < params.targetLifeSpan) return false;
  }
  return assets >= 0;
}
