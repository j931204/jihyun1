import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  ChevronDown,
  Plus,
  RefreshCw,
  Calculator,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  ReferenceArea
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { runSimulation } from './lib/simulation';
import { SimulationParams, IncomeSource, ChildExpenseConfig } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORAGE_KEY = 'retirement_simulation_params_v1';

const DEFAULT_PARAMS: SimulationParams = {
  currentAge: 34,
  targetLifeSpan: 90,
  currentAssets: 42000, 
  incomes: [
    { label: '소득원 1', amount: 5100, currentAge: 34, retirementAge: 50, growthRate: 0.02 },
    { label: '소득원 2', amount: 5600, currentAge: 35, retirementAge: 60, growthRate: 0.03 }
  ],
  coupleExpenses: {
    baseAmount: 5000,
    inflationRate: 0.025,
    deathAge: 90,
    milestones: []
  },
  children: [
    {
      label: '자녀',
      birthYear: 2024,
      baseAmount: 600,
      inflationRate: 0.025,
      independenceAge: 30,
      milestones: [
        { childAge: 3, adjustmentAmount: 240, reason: '어린이집' },
        { childAge: 5, adjustmentAmount: 0, reason: '유치원' },
        { childAge: 8, adjustmentAmount: 210, reason: '초등학교' },
        { childAge: 11, adjustmentAmount: 150, reason: '초등학교 고학년' },
        { childAge: 14, adjustmentAmount: 200, reason: '중학교' },
        { childAge: 17, adjustmentAmount: 400, reason: '고등학교' },
        { childAge: 20, adjustmentAmount: -900, reason: '대학교' },
        { childAge: 25, adjustmentAmount: -300, reason: '취업' }
      ]
    }
  ],
  expectedReturn: 3.0,
  investmentStopAge: 55
};

export default function App() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && 'currentAge' in parsed) {
          setParams(parsed);
        }
      } catch (e) {
        console.error('Failed to load saved params:', e);
      }
    }
  }, []);

  // Save to localStorage whenever params change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  }, [params]);

  const resetParams = () => {
    if (window.confirm('모든 설정을 초기화하시겠습니까?')) {
      setParams(DEFAULT_PARAMS);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const [newMilestone, setNewMilestone] = useState<{
    target: 'couple' | string; // 'couple' or child label
    age: number;
    amount: string | number;
    reason: string;
  }>({ target: 'couple', age: 40, amount: 4000, reason: '' });

  const baseResult = useMemo(() => runSimulation({ ...params, expectedReturn: 3.0 }), [params.currentAge, params.targetLifeSpan, params.currentAssets, params.incomes, params.coupleExpenses, params.children, params.investmentStopAge]);
  const result = useMemo(() => runSimulation(params), [params]);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [expenseCalcTarget, setExpenseCalcTarget] = useState<'couple' | number | null>(null);
  const [expenseItems, setExpenseItems] = useState<{ id: string, label: string, amount: number }[]>([
    { id: '1', label: '주택(대출/월세)', amount: 150 },
    { id: '2', label: '식비', amount: 120 },
    { id: '3', label: '통신/공과금', amount: 30 },
    { id: '4', label: '보험', amount: 40 },
    { id: '5', label: '교통/차량', amount: 50 },
    { id: '6', label: '문화/생활', amount: 80 },
  ]);

  const syncAssets = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-assets');
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        let errorMsg = 'Sync failed';
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          errorMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 200));
        throw new Error('Server returned an invalid response (expected JSON, got HTML). This usually means the API route is not properly configured.');
      }

      const data = await response.json();
      if (data.amount) {
        setParams(prev => ({ ...prev, currentAssets: data.amount }));
      } else {
        throw new Error(data.error || 'No asset data found in the response.');
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      alert(`자산 연동 실패: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateIncome = (index: number, updates: Partial<IncomeSource>) => {
    const newIncomes = [...params.incomes];
    newIncomes[index] = { ...newIncomes[index], ...updates };
    setParams({ ...params, incomes: newIncomes });
  };

  const updateChild = (index: number, updates: Partial<ChildExpenseConfig>) => {
    const newChildren = [...params.children];
    newChildren[index] = { ...newChildren[index], ...updates } as ChildExpenseConfig;
    setParams({ ...params, children: newChildren });
  };

  const addMilestone = () => {
    const amountNum = parseInt(newMilestone.amount.toString()) || 0;
    if (newMilestone.target === 'couple') {
      const newMilestones = [...params.coupleExpenses.milestones, { 
        age: newMilestone.age, 
        adjustmentAmount: amountNum,
        reason: newMilestone.reason.trim() || undefined
      }];
      setParams({
        ...params,
        coupleExpenses: { ...params.coupleExpenses, milestones: newMilestones.sort((a,b) => a.age - b.age) }
      });
    } else {
      const childIdx = params.children.findIndex(c => c.label === newMilestone.target);
      if (childIdx > -1) {
        const newChildMilestones = [...params.children[childIdx].milestones, { 
          childAge: newMilestone.age, 
          adjustmentAmount: amountNum,
          reason: newMilestone.reason.trim() || undefined
        }];
        updateChild(childIdx, { milestones: newChildMilestones.sort((a,b) => a.childAge - b.childAge) });
      }
    }
    // Reset reason after adding
    setNewMilestone(prev => ({ ...prev, reason: '', amount: 0 }));
  };

  const removeMilestone = (target: string, index: number) => {
    if (target === 'couple') {
      const newMilestones = params.coupleExpenses.milestones.filter((_, i) => i !== index);
      setParams({
        ...params,
        coupleExpenses: { ...params.coupleExpenses, milestones: newMilestones }
      });
    } else {
      const childIdx = params.children.findIndex(c => c.label === target);
      if (childIdx > -1) {
        const newChildMilestones = params.children[childIdx].milestones.filter((_, i) => i !== index);
        updateChild(childIdx, { milestones: newChildMilestones });
      }
    }
  };

  const formatCurrency = (val: number) => {
    return `${Math.round(val).toLocaleString()}만원`;
  };

  const formatEok = (val: number) => {
    return `${(val / 10000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}억`;
  };

  const isAggressive = result.totalReturn >= result.requiredReturn;
  const inheritance = useMemo(() => {
    const deathData = result.yearlyData.find(d => d.age === params.coupleExpenses.deathAge);
    return deathData ? deathData.assetsEnd : (result.finalAssets > 0 ? result.finalAssets : 0);
  }, [result, params.coupleExpenses.deathAge]);

  const baseInheritance = useMemo(() => {
    const deathData = baseResult.yearlyData.find(d => d.age === params.coupleExpenses.deathAge);
    return deathData ? deathData.assetsEnd : (baseResult.finalAssets > 0 ? baseResult.finalAssets : 0);
  }, [baseResult, params.coupleExpenses.deathAge]);

  const [savingsYear, setSavingsYear] = useState(new Date().getFullYear());

  const savingsDataForYear = useMemo(() => {
    return result.yearlyData.find(d => d.year === savingsYear) || result.yearlyData[0];
  }, [result.yearlyData, savingsYear]);

  const currentTotalIncome = params.incomes.reduce((acc, curr) => acc + curr.amount, 0);
  const currentTotalExpense = params.coupleExpenses.baseAmount + params.children.reduce((acc, curr) => acc + curr.baseAmount, 0);

  const latestRetirementYear = useMemo(() => {
    const retirementYears = params.incomes.map(s => new Date().getFullYear() + (s.retirementAge - s.currentAge));
    return Math.max(...retirementYears);
  }, [params.incomes]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-100 text-[11px] shadow-brand/5 min-w-[160px]">
          <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1 text-[12px]">{label}세 ({data.year}년)</p>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-8 items-center">
              <span className="text-slate-500 font-bold uppercase tracking-tighter">자산 합계</span>
              <span className="font-bold text-brand text-[12px]">{formatEok(data.assetsEnd)}</span>
            </div>
            <div className="flex justify-between gap-8 items-center">
              <span className="text-slate-500 font-bold uppercase tracking-tighter">연간 수입</span>
              <span className="font-bold text-green-600 text-[12px]">+{formatEok(data.income)}</span>
            </div>
            <div className="flex justify-between gap-8 items-center">
              <span className="text-slate-500 font-bold uppercase tracking-tighter">연간 총지출</span>
              <span className="font-bold text-rose-600 text-[12px]">-{formatEok(data.expenses)}</span>
            </div>
          </div>
          {data.events && data.events.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
              {data.events.map((ev: string, i: number) => (
                <div key={i} className="text-[10px] text-slate-400 font-medium leading-tight flex items-start gap-1.5">
                  <div className="w-1 h-1 bg-slate-300 rounded-full mt-1.5 flex-shrink-0" />
                  <span>{ev}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 px-8 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand rounded flex items-center justify-center text-white font-bold shadow-sm">R</div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">은퇴 시뮬레이션</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={resetParams}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all text-xs font-bold uppercase tracking-tighter"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            초기화
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full">
        
        {/* Row 1: Key Metrics */}
        <section className="col-span-12 order-2 lg:order-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">연간 저축 금액</p>
                <div className="flex items-center gap-2">
                  <select 
                    value={savingsYear}
                    onChange={(e) => setSavingsYear(parseInt(e.target.value))}
                    className="bg-slate-100 border-none rounded-lg px-2 py-1 text-[12px] font-normal text-slate-700 outline-none focus:ring-1 focus:ring-brand cursor-pointer"
                  >
                    {result.yearlyData.map(d => (
                      <option key={d.year} value={d.year}>
                        {d.year}년 ({d.age}세)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-3xl font-bold tracking-tight", savingsDataForYear.investmentAmount >= 0 ? "text-slate-900" : "text-rose-600")}>
                  {formatEok(savingsDataForYear.investmentAmount)}
                </span>
                <span className="text-[16px] font-bold px-1.5 py-0.5 rounded text-[#020813] bg-white">
                  누적 {formatEok(savingsDataForYear.assetsEnd)}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-4 border-t border-slate-50 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 text-[15px]">예상 소득</span>
                <span className="font-bold text-green-600 text-[14px]">+{formatEok(savingsDataForYear.income)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 text-[14px]">예상 지출(부부+자녀)</span>
                <span className="font-bold text-rose-600 text-[15px]">-{formatEok(savingsDataForYear.expenses)}</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">보수적 수익율</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  3.0%
                </span>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-50 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 text-[14px]">자산 고갈 시점</span>
                <span className="font-bold text-[14px] text-black">
                  {baseResult.depletionAge ? `${baseResult.depletionAge}세` : "없음"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 text-[14px]">유산 금액 ({params.coupleExpenses.deathAge}세)</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-black text-[14px] border-b border-[#000000]">{formatEok(baseInheritance)}</span>
                  <span className="text-[12px] text-[#6f6d6d] font-medium">
                    (현재가치: {formatEok(baseInheritance / Math.pow(1 + params.coupleExpenses.inflationRate, params.coupleExpenses.deathAge - params.currentAge))})
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">가정 수익률 시나리오</p>
              </div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <span className="text-3xl font-bold tracking-tight text-brand">
                  {params.expectedReturn.toFixed(1)}%
                </span>
                <div className="flex-1 max-w-[120px]">
                  <input 
                    type="range" 
                    min={0} 
                    max={20} 
                    step={0.1}
                    value={params.expectedReturn} 
                    onChange={(e) => setParams({...params, expectedReturn: parseFloat(e.target.value)})}
                    className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-accent"
                  />
                </div>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-50 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 text-[14px]">자산 고갈 시점</span>
                <span className="font-bold text-[14px] text-black">
                  {result.depletionAge ? `${result.depletionAge}세` : "없음"}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400 text-[14px]">유산 금액 ({params.coupleExpenses.deathAge}세)</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-black text-[14px] border-b border-[#000000]">{formatEok(inheritance)}</span>
                  <span className="text-[12px] text-[#6f6d6d] font-medium">
                    (현재가치: {formatEok(inheritance / Math.pow(1 + params.coupleExpenses.inflationRate, params.coupleExpenses.deathAge - params.currentAge))})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Row 3: Charts & Inputs */}
        <section className="col-span-12 order-1 lg:order-2 lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <div 
              className="flex items-center justify-between border-b border-slate-100 pb-4 cursor-pointer group"
              onClick={() => setIsPanelExpanded(!isPanelExpanded)}
            >
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">변수 제어판</h2>
              <motion.div
                animate={{ rotate: isPanelExpanded ? 0 : 180 }}
                transition={{ duration: 0.2 }}
                className="text-slate-400 group-hover:text-brand"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </div>

            <AnimatePresence initial={false}>
              {isPanelExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 p-4 rounded-xl bg-[#ebebeb]">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-black uppercase tracking-widest">기본 정보</h3>
                      <InputGroup label="현재 나이(지현)" value={params.currentAge} unit="세" onChange={(v) => setParams({...params, currentAge: v})} />
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tight">
                          <div className="flex items-center gap-2">
                            <label className="text-[#5f5d5d]">현재 자산</label>
                            <button 
                              onClick={syncAssets}
                              disabled={isSyncing}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] bg-brand text-white flex items-center hover:bg-brand/90 transition-all disabled:opacity-50",
                                isSyncing && "animate-pulse"
                              )}
                            >
                              [연동]
                            </button>
                          </div>
                          <span className="text-slate-900">{params.currentAssets.toLocaleString()}만원</span>
                        </div>
                        <input 
                          type="range" 
                          min={0} 
                          max={500000} 
                          step={1}
                          value={params.currentAssets} 
                          onChange={(e) => setParams({...params, currentAssets: parseFloat(e.target.value)})}
                          className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-accent"
                        />
                      </div>
                      <InputGroup 
                        label="투자 중단 시점" 
                        value={params.investmentStopAge} 
                        unit="세" 
                        max={80} 
                        min={params.currentAge} 
                        onChange={(v) => setParams({...params, investmentStopAge: v})} 
                      />
                    </div>

                    {/* Incomes */}
                    {params.incomes.map((source, idx) => (
                      <div key={idx} className="space-y-4 pt-4 border-t border-slate-50">
                        <h3 className="text-xs font-black text-black uppercase tracking-widest">{source.label}</h3>
                        <InputGroup label={`${source.label} 나이`} value={source.currentAge} unit="세" max={80} onChange={(v) => updateIncome(idx, { currentAge: v })} />
                        <InputGroup label="소득금액" value={source.amount} unit="만원" max={30000} onChange={(v) => updateIncome(idx, { amount: v })} />
                        <InputGroup label="은퇴 시점" value={source.retirementAge} unit="세" max={80} onChange={(v) => updateIncome(idx, { retirementAge: v })} />
                        <InputGroup label="예상 인상율" value={source.growthRate * 100} unit="%" step={0.1} max={10} onChange={(v) => updateIncome(idx, { growthRate: v / 100 })} />
                      </div>
                    ))}

                    {/* Couple Expenses */}
                    <div className="space-y-4 pt-4 border-t border-slate-100 p-4 rounded-xl bg-[#ffffff]">
                      <h3 className="text-xs font-black text-black bg-[#f5f5f5] px-2 py-1 rounded inline-block uppercase tracking-widest mb-2">지출 항목</h3>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tight">
                          <label className="text-[#5f5d5d]">연간 지출</label>
                          <span className="text-slate-900">{params.coupleExpenses.baseAmount.toLocaleString()}만원</span>
                        </div>
                        
                        <button 
                          onClick={() => setExpenseCalcTarget('couple')}
                          className="w-full px-2 py-1.5 rounded text-[10px] bg-slate-800 text-white flex items-center justify-center gap-1 hover:bg-slate-700 transition-all shadow-sm"
                        >
                          <Calculator className="w-2.5 h-2.5" />
                          지출 계산기
                        </button>

                        <div className="px-1">
                          <input 
                            type="range" 
                            min={0} 
                            max={30000} 
                            step={1}
                            value={params.coupleExpenses.baseAmount} 
                            onChange={(e) => setParams({...params, coupleExpenses: {...params.coupleExpenses, baseAmount: parseFloat(e.target.value)}})}
                            className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-accent"
                          />
                        </div>
                      </div>

                      <InputGroup label="사망 시 예상 나이" value={params.coupleExpenses.deathAge} unit="세" max={110} onChange={(v) => setParams({...params, coupleExpenses: {...params.coupleExpenses, deathAge: v}})} />
                      <InputGroup label="물가 인상율" value={params.coupleExpenses.inflationRate * 100} unit="%" step={0.1} max={10} onChange={(v) => setParams({...params, coupleExpenses: {...params.coupleExpenses, inflationRate: v / 100}})} />
                    </div>

                    {/* Children Expenses */}
                    {params.children.map((child, idx) => (
                      <div key={idx} className="space-y-4 pt-4 border-t border-slate-100 p-4 rounded-xl bg-[#ffffff]">
                        <h3 className="text-[12px] font-black text-[#020813] bg-[#eeeeee] px-2 py-1 rounded inline-block uppercase tracking-widest mb-2">{child.label} 지출</h3>
                        
                        <InputGroup 
                          label="출생(예정) 연도" 
                          value={child.birthYear} 
                          unit="년" 
                          min={2020} 
                          max={2040} 
                          onChange={(v) => updateChild(idx, { birthYear: v })} 
                        />

                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tight">
                            <label className="text-[#5f5d5d]">기초 지출</label>
                            <span className="text-slate-900">{child.baseAmount.toLocaleString()}만원</span>
                          </div>
                          
                          <button 
                            onClick={() => setExpenseCalcTarget(idx)}
                            className="w-full px-2 py-1.5 rounded text-[10px] bg-slate-800 text-white flex items-center justify-center gap-1 hover:bg-slate-700 transition-all shadow-sm"
                          >
                            <Calculator className="w-2.5 h-2.5" />
                            지출 계산기
                          </button>

                          <div className="px-1">
                            <input 
                              type="range" 
                              min={0} 
                              max={10000} 
                              step={1}
                              value={child.baseAmount} 
                              onChange={(e) => updateChild(idx, { baseAmount: parseFloat(e.target.value) })}
                              className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-accent"
                            />
                          </div>
                        </div>

                        <InputGroup label="독립 나이" value={child.independenceAge} unit="세" max={40} onChange={(v) => updateChild(idx, { independenceAge: v })} />
                        <InputGroup label="물가 인상율" value={child.inflationRate * 100} unit="%" step={0.1} max={10} onChange={(v) => updateChild(idx, { inflationRate: v / 100 })} />
                        {/* Milestones simplified as summary in UI for space */}
                      </div>
                    ))}


                    {/* Multi-purpose Milestone Adder */}
                    <div className="space-y-4 pt-6 border-t-2 border-slate-100">
                      <h3 className="text-xs font-black text-brand uppercase tracking-widest flex items-center gap-1">
                        <Plus className="w-3 h-3" /> 조정 시점
                      </h3>
                      <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[#5f5d5d] uppercase">대상</label>
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                            value={newMilestone.target}
                            onChange={(e) => setNewMilestone({...newMilestone, target: e.target.value})}
                          >
                            <option value="couple">부부 공통</option>
                            {params.children.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-[#5f5d5d] uppercase">시점(나이)</label>
                            <input 
                              type="number" 
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                              value={newMilestone.age}
                              onChange={(e) => setNewMilestone({...newMilestone, age: parseInt(e.target.value) || 0})}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-[#5f5d5d] uppercase">금액(만원)</label>
                            <input 
                              type="number" 
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                              value={newMilestone.amount}
                              placeholder="-1000"
                              onChange={(e) => setNewMilestone({...newMilestone, amount: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[#5f5d5d] uppercase">사유/메모</label>
                          <input 
                            type="text" 
                            placeholder="예: 대학 입학, 주택 확장 등"
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand"
                            value={newMilestone.reason}
                            onChange={(e) => setNewMilestone({...newMilestone, reason: e.target.value})}
                          />
                        </div>
                        <button 
                          onClick={addMilestone}
                          className="w-full bg-brand text-white py-2 rounded-lg text-xs font-bold hover:bg-brand/90 transition-colors shadow-sm"
                        >
                          타임라인에 추가
                        </button>
                      </div>
                      
                      {/* Active Milestones List */}
                      <div className="space-y-2">
                        {params.coupleExpenses.milestones.map((m, i) => {
                          const yearsElapsed = m.age - params.currentAge;
                          const futureValue = m.adjustmentAmount * Math.pow(1 + params.coupleExpenses.inflationRate, Math.max(0, yearsElapsed));
                          
                          return (
                            <div key={`c-${i}`} className={cn(
                              "relative flex flex-col border p-2.5 rounded-lg text-xs gap-1",
                              m.adjustmentAmount < 0 ? "bg-teal-50/50 border-teal-100" : "bg-white border-slate-100"
                            )}>
                              <div className="pr-6">
                                <span className={cn("block font-medium", m.adjustmentAmount < 0 ? "text-teal-700" : "text-slate-900")}>
                                  부부: <span className="font-bold underline decoration-slate-200 underline-offset-4">{m.age}세</span> → {m.adjustmentAmount >= 0 ? '+' : ''}{formatCurrency(m.adjustmentAmount)}
                                </span>
                                <span className="block text-[10px] text-[#5b5c5c] font-medium leading-relaxed">
                                  미래가치: <span className="font-bold text-[#4a4b4b]">{m.adjustmentAmount >= 0 ? '+' : ''}{Math.round(futureValue).toLocaleString()}</span>만원
                                </span>
                                {m.reason && (
                                  <div className="text-[11px] text-slate-400 mt-1 pl-1 border-l-2 border-slate-100 bg-slate-50/50 py-0.5 px-2 rounded font-normal">
                                    {m.reason}
                                  </div>
                                )}
                              </div>
                              <button 
                                onClick={() => removeMilestone('couple', i)} 
                                className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-rose-50 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        {params.children.flatMap(c => c.milestones.map((m, i) => ({ ...m, childLabel: c.label, idx: i, childBirthYear: c.birthYear, childInflationRate: c.inflationRate }))).map((m, i) => {
                          const currentYear = new Date().getFullYear();
                          const yearsElapsed = (m.childBirthYear + m.childAge) - currentYear;
                          const futureValue = m.adjustmentAmount * Math.pow(1 + m.childInflationRate, Math.max(0, yearsElapsed));

                          return (
                            <div key={`ch-${i}`} className={cn(
                              "relative flex flex-col border p-2.5 rounded-lg text-xs gap-1",
                              m.adjustmentAmount < 0 ? "bg-teal-50/50 border-teal-100" : "bg-white border-slate-100"
                            )}>
                              <div className="pr-6">
                                <span className={cn("block font-medium", m.adjustmentAmount < 0 ? "text-teal-700" : "text-slate-900")}>
                                  {m.childLabel}: <span className="font-bold underline decoration-slate-200 underline-offset-4">{m.childAge}세</span> → {m.adjustmentAmount >= 0 ? '+' : ''}{formatCurrency(m.adjustmentAmount)}
                                </span>
                                <span className="block text-[10px] text-[#5b5c5c] font-medium leading-relaxed">
                                  미래가치: <span className="font-bold text-[#4a4b4b]">{m.adjustmentAmount >= 0 ? '+' : ''}{Math.round(futureValue).toLocaleString()}</span>만원
                                </span>
                                {m.reason && (
                                  <div className="text-[11px] text-slate-400 mt-1 pl-1 border-l-2 border-slate-100 bg-slate-50/50 py-0.5 px-2 rounded font-normal">
                                    {m.reason}
                                  </div>
                                )}
                              </div>
                              <button 
                                onClick={() => removeMilestone(m.childLabel, m.idx)} 
                                className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-rose-50 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Dashboard Center: Chart */}
        <section className="col-span-12 order-3 lg:col-span-9 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[480px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                <TrendingUp className="w-4 h-4 text-brand" />
                생애 순자산 추이 시뮬레이션
              </h2>
              <div className="flex gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-brand rounded-full"></div> 현재 전략</span>
              </div>
            </div>
            
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.yearlyData}>
                  <defs>
                    <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0500a5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0500a5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="age" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}}
                    tickFormatter={(age) => age % 10 === 0 ? `${age}세` : ''}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}}
                    tickFormatter={(val) => formatEok(val)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {result.depletionAge && (
                    <ReferenceArea 
                      {...({
                        x1: result.depletionAge,
                        x2: params.targetLifeSpan,
                        fill: "#f8fafc",
                        fillOpacity: 0.5
                      } as any)}
                    />
                  )}
                  <Area 
                    type="monotone" 
                    dataKey="assetsEnd" 
                    stroke="#0500a5" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorAssets)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
              <span>{new Date().getFullYear()} Start</span>
              <span className="text-brand">{latestRetirementYear}</span>
              <span>{new Date().getFullYear() + (params.targetLifeSpan - params.currentAge)} Scenario End</span>
            </div>
          </div>




        </section>
      </main>

      {/* Footer */}
      <footer className="h-10 px-8 flex items-center justify-between bg-white border-t border-slate-200 mt-auto">
      </footer>

      {/* Expense Calculator Modal */}
      <AnimatePresence>
        {expenseCalcTarget !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setExpenseCalcTarget(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <h2 className="font-black text-slate-900 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-brand" />
                    지출 계산기 ({expenseCalcTarget === 'couple' ? '부부' : params.children[expenseCalcTarget as number]?.label})
                  </h2>
                </div>
                <button 
                  onClick={() => setExpenseCalcTarget(null)} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="p-6 max-h-[50vh] overflow-y-auto custom-scrollbar space-y-3 bg-white">
                {expenseItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 group">
                    <input 
                      type="text" 
                      value={item.label}
                      onChange={e => {
                        setExpenseItems(prev => prev.map(i => i.id === item.id ? { ...i, label: e.target.value } : i))
                      }}
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-brand focus:bg-white transition-all"
                      placeholder="항목 (예: 식비, 월세)"
                    />
                    <div className="flex items-center gap-2 max-w-[140px]">
                      <input 
                        type="number" 
                        value={item.amount || ''}
                        onChange={e => {
                          setExpenseItems(prev => prev.map(i => i.id === item.id ? { ...i, amount: parseFloat(e.target.value) || 0 } : i))
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-right font-bold text-slate-900 outline-none focus:border-brand focus:bg-white transition-all"
                        placeholder="0"
                      />
                      <span className="text-xs font-bold text-slate-400 whitespace-nowrap">만원</span>
                    </div>
                    <button 
                      onClick={() => setExpenseItems(prev => prev.filter(i => i.id !== item.id))}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setExpenseItems(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), label: '', amount: 0 }])}
                  className="w-full border-2 border-dashed border-slate-100 py-3.5 rounded-2xl text-slate-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:border-brand hover:text-brand hover:bg-brand/5 transition-all"
                >
                  <Plus className="w-4 h-4" /> 항목 추가하기
                </button>
              </div>

              {/* Footer */}
              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">월 평균 지출</p>
                    <p className="text-xl font-bold text-slate-900">
                      {expenseItems.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}만원
                    </p>
                  </div>
                  <div className="bg-brand p-4 rounded-2xl shadow-lg shadow-brand/20 border border-brand/10">
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">연간 환산 (x12)</p>
                    <p className="text-xl font-bold text-white">
                      {(expenseItems.reduce((acc, curr) => acc + curr.amount, 0) * 12).toLocaleString()}만원
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const annualTotal = expenseItems.reduce((acc, curr) => acc + curr.amount, 0) * 12;
                    if (expenseCalcTarget === 'couple') {
                      setParams(prev => ({ ...prev, coupleExpenses: { ...prev.coupleExpenses, baseAmount: annualTotal } }));
                    } else if (typeof expenseCalcTarget === 'number') {
                      updateChild(expenseCalcTarget, { baseAmount: annualTotal });
                    }
                    setExpenseCalcTarget(null);
                  }}
                  className="w-full bg-slate-900 text-white py-4.5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-brand transition-all active:scale-[0.98]"
                >
                  위 금액을 시뮬레이션에 적용
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({ label, value, status, color = 'slate' }: { 
  label: string, 
  value: string, 
  status?: 'success' | 'warning' | 'danger',
  color?: string
}) {
  const isBrand = color === 'brand';
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors"
    >
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-3xl font-bold tracking-tight", isBrand ? "text-brand" : "text-slate-900")}>
          {value}
        </span>
      </div>
    </motion.div>
  );
}

function InputGroup({ label, value, unit, onChange, step = 1, max = 100, min }: { label: string, value: number, unit: string, onChange: (v: number) => void, step?: number, max?: number, min?: number }) {
  const defaultMin = label.includes('나이') ? 1 : 0;
  const finalMin = min !== undefined ? min : defaultMin;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tight">
        <label className="text-[#5f5d5d]">{label}</label>
        <span className="text-slate-900">{value.toLocaleString()}{unit}</span>
      </div>
      <input 
        type="range" 
        min={finalMin} 
        max={max} 
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-accent"
      />
    </div>
  );
}

