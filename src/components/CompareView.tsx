import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  ReferenceArea
} from 'recharts';

const RefArea = ReferenceArea as any;

import { 
  Award, 
  CheckCircle2, 
  TrendingUp, 
  Sparkles, 
  Zap, 
  Timer, 
  RotateCcw, 
  Info,
  Layers
} from 'lucide-react';
import { SessionData } from '../types';

interface CompareViewProps {
  sessions: SessionData[];
  onRemoveSession?: (id: string) => void;
  activeMetric?: string;
}

const RUN_STROKE_COLORS = ['#38bdf8', '#c084fc', '#10b981', '#f59e0b', '#ec4899'];

interface CompareCustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
  sessions: SessionData[];
  compareChartType: 'cumulative' | 'rolling' | 'average';
  activeMetric?: string;
}

// Premium comparison custom tooltip that dynamically ranks files descending at that exact second
const CompareCustomTooltip: React.FC<CompareCustomTooltipProps> = ({ active, payload, label, sessions, compareChartType, activeMetric = 'Damage Out' }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const sec = data.secondNum;

  const isHealing = activeMetric.toLowerCase().includes('healing');
  const isPower = activeMetric.toLowerCase().includes('power');
  const isSupercharge = activeMetric.toLowerCase().includes('supercharge');

  const unitRateLabel = isHealing ? 'HPS' : isPower ? 'PPS' : isSupercharge ? 'SPS' : 'DPS';
  const unitValueLabel = isHealing ? 'Healing' : isPower ? 'Power' : isSupercharge ? 'Supercharge' : 'DMG';

  const records = payload
    .map((item, idx) => {
      const fileName = item.name;
      const value = item.value as number;
      const color = item.stroke || RUN_STROKE_COLORS[idx % RUN_STROKE_COLORS.length];
      const session = sessions.find(s => s.fileName === fileName);
      return { fileName, value, color, session };
    })
    .sort((a, b) => b.value - a.value);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="bg-slate-950 border border-slate-700/85 rounded-xl p-4 shadow-2xl text-slate-200 text-xs max-w-[300px] font-sans backdrop-blur-md bg-opacity-95">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
        <span className="font-extrabold text-slate-100 text-[11px] flex items-center gap-1.5 uppercase tracking-wider">
          <span className="px-1.5 py-0.5 bg-indigo-600 rounded text-[9px] text-white font-mono">+{sec}s</span>
          {compareChartType === 'rolling' ? `${unitRateLabel} COMPARE` : compareChartType === 'average' ? 'AVERAGE COMPARE' : 'Momentum COMPARE'}
        </span>
        <span className="font-mono text-[9px] text-slate-500">
          Ranked Leading Output
        </span>
      </div>

      <div className="space-y-1.5">
        {records.map((rec, rank) => {
          return (
            <div key={rec.fileName} className="flex justify-between items-center text-xs bg-slate-900 bg-slate-900/60 p-1.5 rounded border border-slate-800/40 gap-2">
              <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                <span className="font-mono font-black text-slate-550 text-[10px] w-4 text-slate-450">#{rank + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rec.color }} />
                <span className="text-slate-350 font-bold truncate text-[10.5px]" title={rec.fileName}>
                   {rec.fileName}
                </span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-black text-slate-100 text-[10.5px]">
                  {compareChartType === 'rolling' || compareChartType === 'average' ? `${formatNumber(rec.value)}/s` : formatNumber(rec.value)}
                </span>
                <span className="text-[8px] text-slate-500 font-mono block">
                  {compareChartType === 'rolling' ? `Rolling ${unitRateLabel}` : compareChartType === 'average' ? `Average ${unitValueLabel}` : `Cumulative ${unitValueLabel}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function CompareView({ sessions, onRemoveSession, activeMetric = 'Damage Out' }: CompareViewProps) {
  const [metricToSortBy, setMetricToSortBy] = useState<'overallDps' | 'totalDamage' | 'critRate'>('overallDps');
  const [abilityMetric, setAbilityMetric] = useState<'total' | 'dps' | 'avg'>('total');
  const [skillChartOrientation, setSkillChartOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  const isHealing = activeMetric.toLowerCase().includes('healing');
  const isPower = activeMetric.toLowerCase().includes('power');
  const isSupercharge = activeMetric.toLowerCase().includes('supercharge');

  const unitRateLabel = isHealing ? 'HPS' : isPower ? 'PPS' : isSupercharge ? 'SPS' : 'DPS';
  const unitValueLabel = isHealing ? 'Healing' : isPower ? 'Power' : isSupercharge ? 'Supercharge' : 'Damage';

  if (sessions.length < 2) {
    return (
      <div className="bg-white dark:bg-slate-800 p-10 border border-slate-200 dark:border-slate-700 rounded-2xl text-center flex flex-col items-center justify-center shadow-sm">
        <div className="p-4 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-100 dark:border-indigo-900/35">
          <Award size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">File Comparison Mode</h3>
        <p className="text-sm text-slate-400 dark:text-slate-400 max-w-md mt-1">
          Upload or select at least two different sessions/combat logs to trigger side-by-side comparison, DPS benchmarks, and timelines.
        </p>
      </div>
    );
  }

  // 1. Gather global stats side by side
  const maxDps = Math.max(...sessions.map(s => s.overallDps));
  const maxDamage = Math.max(...sessions.map(s => s.totalDamage));
  const maxCrit = Math.max(...sessions.map(s => s.critRate));

  // 2. Prepare unified Move comparison chart
  const allMoveNamesSet = new Set<string>();
  sessions.forEach(s => s.moves.forEach(m => allMoveNamesSet.add(m.name)));
  const uniqueMoveNames = Array.from(allMoveNamesSet);

  const skillComparisonData = uniqueMoveNames.map(moveName => {
    const entry: Record<string, any> = { moveName };
    sessions.forEach((s) => {
      const match = s.moves.find(m => m.name === moveName);
      if (match) {
        if (abilityMetric === 'total') {
          entry[s.fileName] = match.totalDamage;
        } else if (abilityMetric === 'dps') {
          entry[s.fileName] = match.dps;
        } else {
          entry[s.fileName] = Math.round(match.avgHit);
        }
      } else {
        entry[s.fileName] = 0;
      }
    });
    return entry;
  }).sort((a, b) => {
    const key = sessions[0].fileName;
    return (b[key] || 0) - (a[key] || 0);
  });

  // 3. Prepare Multi-Session Chronological Timeline Chart
  const maxDuration = Math.max(...sessions.map(s => s.durationInSeconds));

  const [compareChartType, setCompareChartType] = useState<'cumulative' | 'rolling' | 'average'>('rolling');

  // Zoom States for Comparison Timeline
  const [left, setLeft] = useState<number>(0);
  const [right, setRight] = useState<number>(maxDuration);
  const [refLeft, setRefLeft] = useState<number | null>(null);
  const [refRight, setRefRight] = useState<number | null>(null);

  const sessionIdsKey = sessions.map(s => s.id).join(',');
  const lastSessionIdsKeyRef = useRef<string>(sessionIdsKey);

  useEffect(() => {
    if (lastSessionIdsKeyRef.current !== sessionIdsKey) {
      setLeft(0);
      setRight(maxDuration);
      setRefLeft(null);
      setRefRight(null);
      lastSessionIdsKeyRef.current = sessionIdsKey;
    } else {
      if (right > maxDuration) {
        setRight(maxDuration);
      }
    }
  }, [sessionIdsKey, maxDuration]);

  const isZoomed = left > 0 || right < maxDuration;

  // Zoomed interval stats computed dynamically per combat log
  const zoomedStats = useMemo(() => {
    return sessions.map(session => {
      const zoomedTimeline = session.timeline.filter(pt => pt.timeInSeconds >= left && pt.timeInSeconds <= right);
      const dmg = zoomedTimeline.reduce((sum, pt) => sum + pt.damageSum, 0);
      const duration = Math.max(1, right - left);
      const dps = Math.round(dmg / duration);
      return { id: session.id, dmg, dps };
    });
  }, [sessions, left, right]);

  const maxIntervalDps = useMemo(() => Math.max(...zoomedStats.map(s => s.dps), 0), [zoomedStats]);
  const maxIntervalDmg = useMemo(() => Math.max(...zoomedStats.map(s => s.dmg), 0), [zoomedStats]);

  // Zoom presets
  const zoomToPreset = (type: 'all' | 'opener' | 'execute' | 'sustained') => {
    if (type === 'all') {
      setLeft(0);
      setRight(maxDuration);
    } else if (type === 'opener') {
      setLeft(0);
      setRight(Math.min(maxDuration, 15));
    } else if (type === 'execute') {
      const start = Math.max(0, maxDuration - 15);
      setLeft(start);
      setRight(maxDuration);
    } else if (type === 'sustained') {
      // Find range of "big damage" peaks.
      // We look at the absolute peak (max second-by-second damage Sum) across all runs, 
      // and define "big damage" as any second >= 20% of that maximum peak.
      let absolutePeak = 0;
      sessions.forEach(s => {
        s.timeline.forEach(pt => {
          if (pt.damageSum > absolutePeak) {
            absolutePeak = pt.damageSum;
          }
        });
      });

      const threshold = absolutePeak * 0.20;
      let firstPeakSec = maxDuration;
      let lastPeakSec = 0;

      sessions.forEach(s => {
        s.timeline.forEach(pt => {
          if (pt.damageSum >= threshold) {
            if (pt.timeInSeconds < firstPeakSec) {
              firstPeakSec = pt.timeInSeconds;
            }
            if (pt.timeInSeconds > lastPeakSec) {
              lastPeakSec = pt.timeInSeconds;
            }
          }
        });
      });

      // Verify and set left/right boundaries
      if (lastPeakSec > firstPeakSec) {
        setLeft(firstPeakSec);
        setRight(lastPeakSec);
      } else {
        // Fallback to active middle combat duration range
        setLeft(Math.max(0, Math.floor(maxDuration * 0.15)));
        setRight(Math.min(maxDuration, Math.floor(maxDuration * 0.85)));
      }
    }
  };

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel !== undefined) {
      setRefLeft(Number(e.activeLabel));
    }
  };

  const handleMouseMove = (e: any) => {
    if (refLeft !== null && e && e.activeLabel !== undefined) {
      setRefRight(Number(e.activeLabel));
    }
  };

  const handleMouseUp = () => {
    if (refLeft !== null && refRight !== null && refLeft !== refRight) {
      let start = Math.min(refLeft, refRight);
      let end = Math.max(refLeft, refRight);
      
      start = Math.max(0, start);
      end = Math.min(maxDuration, end);

      if (end - start >= 1) {
        setLeft(start);
        setRight(end);
      }
    }
    setRefLeft(null);
    setRefRight(null);
  };

  const comparisonTimelineData = useMemo(() => {
    return Array.from({ length: maxDuration + 1 }, (_, secondNum) => {
      const point: Record<string, any> = { second: `${secondNum}s`, secondNum };
      sessions.forEach(s => {
        const match = s.timeline.find(t => t.timeInSeconds === secondNum);
        if (match) {
          if (compareChartType === 'cumulative') {
            point[s.fileName] = match.cumulativeDamage;
          } else if (compareChartType === 'average') {
            point[s.fileName] = secondNum > 0 ? Math.round(match.cumulativeDamage / secondNum) : match.damageSum;
          } else {
            // Calculate a 5s rolling dps dynamically for side-by-side comparison accuracy
            const startSec = Math.max(0, secondNum - 4);
            let totalDmgInWindow = 0;
            let secsCount = 0;
            for (let sec = startSec; sec <= secondNum; sec++) {
              const pt = s.timeline.find(t => t.timeInSeconds === sec);
              if (pt) {
                totalDmgInWindow += pt.damageSum;
              }
              secsCount++;
            }
            point[s.fileName] = Math.round(totalDmgInWindow / Math.max(1, secsCount));
          }
        } else {
          if (compareChartType === 'cumulative') {
            const lastPt = s.timeline[s.timeline.length - 1];
            point[s.fileName] = secondNum > s.durationInSeconds ? (lastPt?.cumulativeDamage || s.totalDamage) : 0;
          } else if (compareChartType === 'average') {
            const lastPt = s.timeline[s.timeline.length - 1];
            const elapsed = Math.min(secondNum, s.durationInSeconds);
            point[s.fileName] = elapsed > 0 ? Math.round((lastPt?.cumulativeDamage || s.totalDamage) / elapsed) : 0;
          } else {
            point[s.fileName] = 0;
          }
        }
      });
      return point;
    });
  }, [sessions, maxDuration, compareChartType]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-8" id="combat-log-comparison">
      {/* 1. Header Grid Metrics Cards */}
      <h3 className="text-xl font-black font-sans text-slate-800 dark:text-slate-100">
        Shared Combat Comparison Benchmarks
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session, index) => {
          const runColor = RUN_STROKE_COLORS[index % RUN_STROKE_COLORS.length];
          const isDpsWinner = session.overallDps === maxDps;
          const currentZoomed = zoomedStats.find(zs => zs.id === session.id) || { dmg: 0, dps: 0 };
          const isIntervalDpsWinner = currentZoomed.dps === maxIntervalDps && maxIntervalDps > 0;
          const isIntervalDmgWinner = currentZoomed.dmg === maxIntervalDmg && maxIntervalDmg > 0;

          return (
            <div 
              key={session.id}
              className={`bg-white dark:bg-slate-800 border rounded-2xl p-5 relative overflow-hidden transition-all shadow-sm ${
                isDpsWinner 
                  ? 'border-indigo-500/50 dark:border-indigo-500/60 shadow-lg shadow-indigo-100/40 dark:shadow-none' 
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {isDpsWinner && (
                <div className="absolute top-0 right-0 bg-indigo-600 dark:bg-indigo-500 text-white font-bold font-sans text-[10px] px-3 py-1 rounded-bl-xl flex items-center gap-1 uppercase tracking-wider shadow-sm">
                  <Award size={11} />
                  Top Performer
                </div>
              )}

              {/* Run identity */}
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-3.5 h-3.5 rounded-full inline-block animate-none" style={{ backgroundColor: runColor }} />
                <div className="overflow-hidden">
                  <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm truncate max-w-[190px]" title={session.fileName}>
                    {session.fileName}
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-450 uppercase font-mono font-bold">
                    Initiator: <span className="text-slate-600 dark:text-slate-350 font-sans font-extrabold">{session.initiatorName}</span>
                  </p>
                </div>
              </div>

              {/* Big DPS value badge centered cleanly */}
              <div className="mb-3 bg-indigo-50/40 dark:bg-slate-900/40 rounded-xl p-3 border border-indigo-100 dark:border-slate-700/60 text-center">
                <span className="text-slate-400 dark:text-slate-450 text-[10px] font-bold block uppercase font-mono">Average {unitRateLabel}</span>
                <span className="text-xl font-black font-sans text-slate-800 dark:text-slate-100">{formatNumber(Math.round(session.overallDps))}/s</span>
              </div>



              {/* Side facts */}
              <div className="space-y-2.5 text-xs font-mono text-slate-500 dark:text-slate-400 font-extrabold">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1.5">
                  <span>Total {unitValueLabel}:</span>
                  <span className="text-slate-700 dark:text-slate-200 font-extrabold">{formatNumber(session.totalDamage)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1.5">
                  <span>Combat Duration:</span>
                  <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1 font-sans">
                    <Timer size={12} /> {session.durationInSeconds}s
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1.5">
                  <span>Critical Strike:</span>
                  <span className={`font-extrabold ${session.critRate === maxCrit ? 'text-emerald-650 dark:text-emerald-400 font-black' : 'text-slate-700 dark:text-slate-200'}`}>
                    {session.critRate}%
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1.5">
                  <span>Total Act Hits:</span>
                  <span className="text-slate-600 dark:text-slate-300">{session.hitCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Targets:</span>
                  <span className="text-slate-600 dark:text-slate-300">{session.activeTargetCount}</span>
                </div>
              </div>

              {/* Actions */}
              {onRemoveSession && (
                <button
                  onClick={() => onRemoveSession(session.id)}
                  className="mt-4 w-full p-2 rounded-lg bg-rose-55 dark:bg-rose-955 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/40 text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-all cursor-pointer"
                >
                  Unselect Run
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Cumulative / Rolling DPS Comparison Chart */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        {/* Title Section (gives full width and space to title) */}
        <div className="mb-6">
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
            <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={20} />
            Build Momentum & Ramp Comparison
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {compareChartType === 'rolling' 
              ? `Compare real-time combat rolling average ${unitRateLabel} (Y Axis) over run progress (X Axis)`
              : compareChartType === 'average'
                ? `Compare running average ${unitValueLabel.toLowerCase()} output up to each point in time (Y Axis) over elapsed combat seconds (X Axis)`
                : `Compare combat pacing—accumulated ${unitValueLabel.toLowerCase()} sums (Y Axis) over clock time (X Axis)`
            }
          </p>
        </div>

        {/* Controls Layout Structure: Toggle (Rolling / Cumulative) on top, Time Focus beneath it */}
        <div className="flex flex-col gap-4 mb-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          {/* Chart Type Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center">
            <div className="flex flex-wrap bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-1 rounded-xl w-full sm:w-auto gap-1">
              <button
                onClick={() => setCompareChartType('rolling')}
                className={`flex-1 sm:flex-none text-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  compareChartType === 'rolling'
                    ? 'bg-indigo-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Rolling {unitRateLabel}
              </button>
              <button
                onClick={() => setCompareChartType('average')}
                className={`flex-1 sm:flex-none text-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  compareChartType === 'average'
                    ? 'bg-indigo-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Average {unitValueLabel === 'Damage' ? 'DMG' : unitValueLabel}
              </button>
              <button
                onClick={() => setCompareChartType('cumulative')}
                className={`flex-1 sm:flex-none text-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  compareChartType === 'cumulative'
                    ? 'bg-indigo-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Cumulative {unitValueLabel === 'Damage' ? 'DMG' : unitValueLabel}
              </button>
            </div>
          </div>

          {/* Time Focus Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-450 uppercase tracking-widest sm:w-28 shrink-0">Time Focus:</span>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                <button
                  onClick={() => zoomToPreset('all')}
                  className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded border transition-all cursor-pointer ${!isZoomed ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 font-black' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-750 dark:hover:text-slate-300'}`}
                >
                  Full
                </button>
                <button
                  onClick={() => zoomToPreset('opener')}
                  className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded border transition-all cursor-pointer ${left === 0 && right === 15 ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 font-black' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-750 dark:hover:text-slate-300'}`}
                  title="First 15 seconds opener comparison"
                >
                  Opener (15s)
                </button>
                <button
                  onClick={() => zoomToPreset('execute')}
                  className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded border transition-all cursor-pointer ${right === maxDuration && left === maxDuration - 15 ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 font-black' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-750 dark:hover:text-slate-300'}`}
                  title="Compare the final 15 seconds execute window output side by side"
                >
                  Execute (15s)
                </button>
                <button
                  onClick={() => zoomToPreset('sustained')}
                  className={`flex-grow sm:flex-none text-center px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded border transition-all cursor-pointer ${left > 0 && right < maxDuration && !(left === maxDuration - 15) ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40 font-black' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-750 dark:hover:text-[#6366f1]'}`}
                  title={`Zoom from first high peak of big ${unitValueLabel.toLowerCase()} to the last peak of big ${unitValueLabel.toLowerCase()}`}
                >
                  Sustained {unitValueLabel === 'Damage' ? 'DMG' : unitValueLabel} Range
                </button>
              </div>
              {isZoomed && (
                <button
                  onClick={() => zoomToPreset('all')}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-905/40 text-rose-600 dark:text-rose-400 cursor-pointer w-full sm:w-auto justify-center"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Interval Focus Damages & DPS per Log (Aggregated Side-by-Side Comparison) */}
        {isZoomed && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/60 dark:border-slate-800 mb-4 text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={16} />
              <h4 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Interval Focus Stats per Log
              </h4>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-400 font-black font-mono text-[10px] rounded tracking-wider">
                {left}s - {right}s Selection
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Dynamic slice values calculated in real-time for each comparison log
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session, index) => {
              const runColor = RUN_STROKE_COLORS[index % RUN_STROKE_COLORS.length];
              const currentZoomed = zoomedStats.find(zs => zs.id === session.id) || { dmg: 0, dps: 0 };
              const isIntervalDpsWinner = currentZoomed.dps === maxIntervalDps && maxIntervalDps > 0;
              const isIntervalDmgWinner = currentZoomed.dmg === maxIntervalDmg && maxIntervalDmg > 0;
              
              const sharePercent = session.totalDamage > 0 
                ? Math.round((currentZoomed.dmg / session.totalDamage) * 100) 
                : 0;

              return (
                <div 
                  key={`zoomed-${session.id}`}
                  className={`bg-white dark:bg-slate-800/60 p-3 rounded-xl border transition-all ${
                    isIntervalDpsWinner 
                      ? 'border-indigo-500/50 dark:border-indigo-500/40 bg-indigo-50/5 dark:bg-indigo-950/5 ring-1 ring-indigo-500/10' 
                      : 'border-slate-200 dark:border-slate-800 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 w-full">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 animate-none" style={{ backgroundColor: runColor }} />
                      <h5 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[150px] sm:max-w-xs" title={session.fileName}>
                        {session.fileName}
                      </h5>
                    </div>
                    {isIntervalDpsWinner && (
                      <span className="text-[8px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-black px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 origin-right">
                        Winner
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 divide-x divide-slate-100 dark:divide-slate-800 pt-1">
                    <div>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-bold uppercase font-mono tracking-wide">Interval {unitRateLabel}</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="font-sans font-black text-slate-800 dark:text-slate-100 text-sm">
                          {formatNumber(currentZoomed.dps)}/s
                        </span>
                        {isIntervalDpsWinner && (
                          <span className="text-[8px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/40 text-emerald-700 dark:text-emerald-400 px-1 py-0.5 rounded font-black tracking-tighter" title={`Highest interval ${unitRateLabel}`}>
                            Top
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pl-3">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-bold uppercase font-mono tracking-wide">Interval Share</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="font-sans font-black text-slate-800 dark:text-slate-100 text-sm">
                          {sharePercent}%
                        </span>
                        {isIntervalDmgWinner && (
                          <span className="text-[9px] font-bold text-amber-500 ml-1" title={`Highest interval contribution share`}>
                            ★
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Tip helper banner for Compare zoom */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 mb-4 animate-none">
          <Info size={14} className="text-indigo-505 text-indigo-500 shrink-0" />
          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans leading-snug">
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">Side-by-side zoom:</span> Click and drag horizontally over the comparison timeline below to zoom synchronously into specific segments.
          </span>
        </div>

        <div className="w-full h-80 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={comparisonTimelineData} 
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.15} className="opacity-15 dark:stroke-slate-700" />
              <XAxis 
                type="number"
                dataKey="secondNum" 
                domain={[left, right]}
                allowDataOverflow={true}
                tickFormatter={(val) => `${val}s`}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                axisLine={{ stroke: '#475569', opacity: 0.2 }}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatNumber}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                axisLine={{ stroke: '#475569', opacity: 0.2 }}
                tickLine={false}
              />
              <Tooltip
                content={<CompareCustomTooltip sessions={sessions} compareChartType={compareChartType} activeMetric={activeMetric} />}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              {sessions.map((s, index) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.fileName}
                  stroke={RUN_STROKE_COLORS[index % RUN_STROKE_COLORS.length]}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              ))}
              {refLeft !== null && refRight !== null && (
                <RefArea 
                  x1={refLeft} 
                  x2={refRight} 
                  fill="#6366f1" 
                  fillOpacity={0.15} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Skill DPS Contribution Chart */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Layers className="text-indigo-600 dark:text-indigo-400" size={18} />
              Ability Metrics Comparisons Side-by-Side
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-455">
              Breakdown of skill metrics compared across all checked combat logs
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
            {/* Chart Type Toggle */}
            <div className="flex bg-slate-105 bg-slate-100 dark:bg-slate-900 border dark:border-slate-700 border-slate-200 rounded-xl p-1 gap-1 shadow-inner shrink-0">
              <button
                onClick={() => setSkillChartOrientation('vertical')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  skillChartOrientation === 'vertical'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                Vertical Chart
              </button>
              <button
                onClick={() => setSkillChartOrientation('horizontal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  skillChartOrientation === 'horizontal'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                Horizontal Chart
              </button>
            </div>

            {/* Metrics Options */}
            <div className="flex bg-slate-105 bg-slate-100 dark:bg-slate-900 border dark:border-slate-700 border-slate-200 rounded-xl p-1 gap-1 shadow-inner shrink-0">
              <button
                onClick={() => setAbilityMetric('total')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  abilityMetric === 'total' 
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                Totals Damage
              </button>
              <button
                onClick={() => setAbilityMetric('dps')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  abilityMetric === 'dps' 
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                Damage Per Second
              </button>
              <button
                onClick={() => setAbilityMetric('avg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  abilityMetric === 'avg' 
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md' 
                    : 'text-slate-600 dark:text-slate-450 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                Average Hit
              </button>
            </div>
          </div>
        </div>

        <div 
          className="w-full transition-all duration-300"
          style={{ height: skillChartOrientation === 'horizontal' ? `${Math.max(320, skillComparisonData.length * 36)}px` : '320px' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              layout={skillChartOrientation === 'horizontal' ? 'vertical' : 'horizontal'}
              data={skillComparisonData} 
              margin={{ top: 10, right: 20, left: skillChartOrientation === 'horizontal' ? 10 : 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.15} className="opacity-15 dark:stroke-slate-700" />
              {skillChartOrientation === 'horizontal' ? (
                <>
                  <XAxis 
                    type="number"
                    tickFormatter={formatNumber}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                    axisLine={{ stroke: '#475569', opacity: 0.2 }}
                    tickLine={false}
                  />
                  <YAxis 
                    dataKey="moveName" 
                    type="category"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                    axisLine={{ stroke: '#475569', opacity: 0.2 }}
                    tickFormatter={(val) => val.length > 20 ? `${val.substring(0, 17)}...` : val}
                    tickLine={false}
                    width={110}
                  />
                </>
              ) : (
                <>
                  <XAxis 
                    dataKey="moveName" 
                    type="category"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                    axisLine={{ stroke: '#475569', opacity: 0.2 }}
                    tickFormatter={(val) => val.length > 15 ? `${val.substring(0, 11)}...` : val}
                    tickLine={false}
                  />
                  <YAxis 
                    tickFormatter={formatNumber}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                    axisLine={{ stroke: '#475569', opacity: 0.2 }}
                    tickLine={false}
                  />
                </>
              )}
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)' }}
                labelStyle={{ fontWeight: 'bold', color: '#f8fafc' }}
                itemStyle={{ color: '#cbd5e1' }}
                formatter={(value: any, name: any) => {
                  let unit = unitValueLabel;
                  if (abilityMetric === 'dps') unit = unitRateLabel;
                  if (abilityMetric === 'avg') unit = 'Avg Hit';
                  return [`${formatNumber(Number(value))} ${unit}`, name];
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
              {sessions.map((s, index) => (
                <Bar
                  key={s.id}
                  dataKey={s.fileName}
                  fill={RUN_STROKE_COLORS[index % RUN_STROKE_COLORS.length]}
                  radius={skillChartOrientation === 'horizontal' ? [0, 3, 3, 0] : [3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
