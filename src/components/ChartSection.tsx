import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine
} from 'recharts';

const RefArea = ReferenceArea as any;
const RefLine = ReferenceLine as any;

import { 
  BarChart3, 
  TrendingUp, 
  Zap, 
  Clock, 
  RotateCcw, 
  Sparkles, 
  Search, 
  Activity, 
  Flame, 
  Timer, 
  Award, 
  ChevronRight,
  Info,
  Scissors,
  Video
} from 'lucide-react';
import { SessionData, MoveStats } from '../types';

interface ChartSectionProps {
  session: SessionData;
  onTrim?: (id: string, startSec: number, endSec: number) => void;
  zoomLeft?: number;
  zoomRight?: number;
  onZoomChange?: (left: number, right: number) => void;
  activeMetric?: string;
}

// Vibrant, diverse, high-contrast, easily identifiable skill palette
const MOVE_COLORS: Record<string, string> = {
  'Shuriken Storm Mastery': '#6366f1', // Indigo
  'Equilibrium': '#10b981',            // Emerald
  'Detonate': '#ef4444',               // Crimson/Red
  'Meteor Strike': '#f59e0b',          // Amber
  'Stoke Flames': '#06b6d4',           // Cyan
  'Clap Mastery': '#8b5cf6',           // Royal Violet
  'Recovery': '#14b8a6',               // Teal
  'Overheat': '#f97316',               // Tangy Orange
  'Immolation': '#ec4899',             // Deep Pink
  'Sunstone Helix Spike': '#3b82f6',   // Bright Blue
  'Sunstone Shatter': '#a855f7',       // Magenta Purple
  'Unknown Skill': '#64748b'           // Slate Blue
};

const DEFAULT_COLORS = [
  '#6366f1', '#10b981', '#ef4444', '#f59e0b', 
  '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899',
  '#3b82f6', '#a855f7', '#059669', '#db2777', '#0284c7'
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
  mode: 'average' | 'timeline';
  session: SessionData;
  activeMetric?: string;
}

// Custom Tooltip component
const CombatCustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, mode, session, activeMetric = 'Damage Out' }) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const sec = data.secondNum;

  const isHealing = activeMetric.toLowerCase().includes('healing');
  const isPower = activeMetric.toLowerCase().includes('power');
  const isSupercharge = activeMetric.toLowerCase().includes('supercharge');

  const unitRateLabel = isHealing ? 'HPS' : isPower ? 'PPS' : isSupercharge ? 'SPS' : 'DPS';
  const unitValueLabel = isHealing ? 'Healing' : isPower ? 'Power' : isSupercharge ? 'Supercharge' : 'Damage';

  // Extract keys representing actor:moveName (and exclude rolling_ prefixed keys)
  const moveKeys = Object.keys(data).filter(k => k.includes(':') && !k.startsWith('rolling_'));
  const intervalMoves = moveKeys
    .map((key, idx) => {
      const parts = key.split(':');
      const actor = parts[0];
      const moveName = parts.slice(1).join(':');
      const damage = data[key] as number;
      return { key, actor, moveName, damage };
    })
    .filter(m => m.damage > 0)
    .sort((a, b) => b.damage - a.damage);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-2xl text-slate-700 dark:text-slate-200 text-xs max-w-[280px] font-sans backdrop-blur-md bg-opacity-95">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
        <span className="font-extrabold text-slate-900 dark:text-slate-100 text-[11px] flex items-center gap-1.5 uppercase tracking-wider">
          <span className="px-1.5 py-0.5 bg-indigo-600 rounded text-[9px] text-white font-mono">+{sec}s</span>
          Time Capsule
        </span>
        <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500">
          {(sec * 1000000).toLocaleString()} <span className="opacity-60">μs</span>
        </span>
      </div>

      <div className="space-y-1.5 mb-3 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/40">
        {mode === 'average' ? (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">Running Avg {unitRateLabel}:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatNumber(data.average)}/s
            </span>
          </div>
        ) : (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">Rolling {unitRateLabel}:</span>
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
              {formatNumber(data.rollingDps)}/s
            </span>
          </div>
        )}
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 dark:text-slate-400">Inst. {unitValueLabel} (This Sec):</span>
          <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
            {formatNumber(data.damage)}
          </span>
        </div>
      </div>

      {intervalMoves.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 border-b border-slate-100 dark:border-slate-850 pb-1">
            <span>⚔️ Combat Logs ({intervalMoves.length})</span>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
            {intervalMoves.map((m, idx) => {
              const color = MOVE_COLORS[m.moveName] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
              const displayName = m.actor && m.actor !== session.initiatorName
                ? `${m.moveName} (${m.actor})`
                : m.moveName;
              return (
                <div key={m.key} className="flex justify-between items-center text-[10px] gap-2">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-slate-650 dark:text-slate-300 truncate font-semibold">
                      {displayName}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100 shrink-0">
                    {formatNumber(m.damage)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center py-1">
          No ability activity this second
        </div>
      )}
    </div>
  );
};

export default function ChartSection({ session, onTrim, zoomLeft, zoomRight, onZoomChange, activeMetric = 'Damage Out' }: ChartSectionProps) {
  const isHealing = activeMetric.toLowerCase().includes('healing');
  const isPower = activeMetric.toLowerCase().includes('power');
  const isSupercharge = activeMetric.toLowerCase().includes('supercharge');

  const unitRateLabel = isHealing ? 'HPS' : isPower ? 'PPS' : isSupercharge ? 'SPS' : 'DPS';
  const unitValueLabel = isHealing ? 'Healing' : isPower ? 'Power' : isSupercharge ? 'Supercharge' : 'Damage';

  const [activeChart, setActiveChart] = useState<'breakdown' | 'average' | 'timeline'>('timeline');
  const [chartSubtype, setChartSubtype] = useState<'bar' | 'horizontal'>('bar');
  const [breakdownMetric, setBreakdownMetric] = useState<'damage' | 'dps' | 'average'>('damage');
  const [selectedOverlayKeys, setSelectedOverlayKeys] = useState<string[]>([]);

  const { moves, timeline } = session;

  // Zoom Domain & Splicing Point States
  const [fallbackLeft, setFallbackLeft] = useState<number>(0);
  const [fallbackRight, setFallbackRight] = useState<number>(session.durationInSeconds);

  const left = zoomLeft !== undefined ? zoomLeft : fallbackLeft;
  const right = zoomRight !== undefined ? zoomRight : fallbackRight;

  const setLeftAndRight = (l: number, r: number) => {
    if (onZoomChange) {
      onZoomChange(l, r);
    } else {
      setFallbackLeft(l);
      setFallbackRight(r);
    }
  };

  const [refLeft, setRefLeft] = useState<number | null>(null);
  const [refRight, setRefRight] = useState<number | null>(null);

  // Sync zoom constraints when session updates
  useEffect(() => {
    setLeftAndRight(0, session.durationInSeconds);
    setRefLeft(null);
    setRefRight(null);
    setSelectedOverlayKeys([]);
  }, [session.id, session.durationInSeconds]);

  // Find Peak Burst coordinates and Sustained Peak boundaries
  const peakDamage = useMemo(() => {
    return Math.max(...timeline.map(pt => pt.damageSum), 0);
  }, [timeline]);

  const sustainedBounds = useMemo(() => {
    // Threshold is 20% of peak, finds first peak start & last peak end
    const threshold = peakDamage > 0 ? 0.20 * peakDamage : 1;
    let startSec = 0;
    let endSec = session.durationInSeconds;

    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].damageSum >= threshold) {
        startSec = timeline[i].timeInSeconds;
        break;
      }
    }

    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].damageSum >= threshold) {
        endSec = timeline[i].timeInSeconds;
        break;
      }
    }

    // Keep safe margin if the combat is too short
    if (endSec - startSec < 3) {
      startSec = 0;
      endSec = session.durationInSeconds;
    }

    return { startSec, endSec };
  }, [timeline, peakDamage, session.durationInSeconds]);

  // 1. Prepare breakdown chart data (Overall totals)
  const breakdownData = useMemo(() => {
    return moves.map((m, idx) => ({
      name: m.actor && m.actor !== session.initiatorName ? `${m.name} (${m.actor})` : m.name,
      damage: m.totalDamage,
      dps: m.dps,
      average: Math.round(m.avgHit),
      critRate: m.critRate,
      color: MOVE_COLORS[m.name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
    }));
  }, [moves, session.initiatorName]);

  // 2. Prepare average & dynamic DPS data with rolling overlays
  const timelineData = useMemo(() => {
    return timeline.map(point => {
      // Calculate sliding average DPS around this second
      const rollingSeconds = 3;
      const startIndex = Math.max(0, point.timeInSeconds - rollingSeconds);
      const endIndex = point.timeInSeconds;
      
      let sumThisWindow = 0;
      let windowDuration = 0;
      
      for (let k = startIndex; k <= endIndex; k++) {
        if (timeline[k]) {
          sumThisWindow += timeline[k].damageSum;
          windowDuration++;
        }
      }
      const rollingDps = windowDuration > 0 ? Math.round(sumThisWindow / windowDuration) : 0;

      // Running average average damage over time
      const runningAvgDps = point.timeInSeconds > 0 
        ? Math.round(point.cumulativeDamage / point.timeInSeconds)
        : point.damageSum;

      const item: Record<string, any> = {
        second: `${point.timeInSeconds}s`,
        secondNum: point.timeInSeconds,
        damage: point.damageSum,
        cumulative: point.cumulativeDamage,
        average: runningAvgDps, // replace cumulative with active running average
        rollingDps: rollingDps,
        ...point.moves
      };

      // Add individual move rolling DPS for overlapped charting
      moves.forEach(m => {
        const key = `${m.actor}:${m.name}`;
        let moveSumThisWindow = 0;
        let moveWinDuration = 0;
        for (let k = startIndex; k <= endIndex; k++) {
          if (timeline[k]) {
            const mvDmg = timeline[k].moves[key] || 0;
            moveSumThisWindow += mvDmg;
            moveWinDuration++;
          }
        }
        item[`rolling_${key}`] = moveWinDuration > 0 ? Math.round(moveSumThisWindow / moveWinDuration) : 0;
      });

      return item;
    });
  }, [timeline, moves]);

  // Zoom bounds details
  const isZoomed = left > 0 || right < session.durationInSeconds;

  // Zoom presets triggers
  const zoomToPreset = (type: 'all' | 'sustained') => {
    if (type === 'all') {
      setLeftAndRight(0, session.durationInSeconds);
    } else if (type === 'sustained') {
      setLeftAndRight(sustainedBounds.startSec, sustainedBounds.endSec);
    }
  };

  // Drag-to-zoom mouse events
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
    if (refLeft !== null && refRight !== null) {
      if (refLeft !== refRight) {
        let start = Math.min(refLeft, refRight);
        let end = Math.max(refLeft, refRight);
        
        start = Math.max(0, start);
        end = Math.min(session.durationInSeconds, end);

        if (end - start >= 1) {
          setLeftAndRight(start, end);
        }
      }
    }
    setRefLeft(null);
    setRefRight(null);
  };

  // Zoomed Window calculations & detailed move sequence analysis
  const zoomedAnalysis = useMemo(() => {
    const zoomedTimeline = timeline.filter(pt => pt.timeInSeconds >= left && pt.timeInSeconds <= right);
    const windowTotalDamage = zoomedTimeline.reduce((sum, pt) => sum + pt.damageSum, 0);
    const windowDuration = Math.max(1, right - left);
    const windowDps = Math.round(windowTotalDamage / windowDuration);
    
    // Percent contribution of zoomed window of overall combat log
    const overallDamage = session.totalDamage || 1;
    const damagePercentContribution = Number(((windowTotalDamage / overallDamage) * 100).toFixed(1));

    // Calculate moves split in this zoomed window
    const movesDmgMap: Record<string, number> = {};
    zoomedTimeline.forEach(pt => {
      Object.entries(pt.moves).forEach(([key, val]) => {
        movesDmgMap[key] = (movesDmgMap[key] || 0) + (val as number);
      });
    });

    const windowMoves = Object.entries(movesDmgMap)
      .map(([key, dmg]) => {
        const parts = key.split(':');
        const actor = parts[0];
        const moveName = parts.slice(1).join(':');
        const percentage = windowTotalDamage > 0 ? Number(((dmg / windowTotalDamage) * 100).toFixed(1)) : 0;
        return { key, actor, moveName, totalDamage: dmg, percentage };
      })
      .filter(m => m.totalDamage > 0)
      .sort((a, b) => b.totalDamage - a.totalDamage);

    // Filter seconds with damage inside zoomed bounds for chronological feed
    const combatEventsStream = zoomedTimeline
      .filter(pt => pt.damageSum > 0)
      .map(pt => {
        // Use pt.actions if available to display actual millisecond cast ordering
        const ticks = pt.actions && pt.actions.length > 0
          ? pt.actions.map((act, idx) => ({
              key: `${act.actor}:${act.moveName}-${act.timestamp}-${idx}`,
              actor: act.actor,
              moveName: act.moveName,
              damage: act.damage,
              isCrit: act.isCrit,
              target: act.target
            }))
          : Object.entries(pt.moves)
              .map(([key, value]) => {
                const parts = key.split(':');
                return {
                  key,
                  actor: parts[0],
                  moveName: parts.slice(1).join(':'),
                  damage: value as number,
                  isCrit: false,
                  target: 'Sparring Target'
                };
              })
              .filter(t => t.damage > 0)
              .sort((a, b) => b.damage - a.damage);

        return {
          secondNum: pt.timeInSeconds,
          totalDamage: pt.damageSum,
          ticks
        };
      });

    return {
      windowTotalDamage,
      windowDps,
      damagePercentContribution,
      windowMoves,
      combatEventsStream,
      duration: windowDuration
    };
  }, [timeline, left, right, session.totalDamage]);

  const visibleMoves = useMemo(() => {
    const activeKeys = new Map(zoomedAnalysis.windowMoves.map(wm => [wm.key, wm.percentage]));
    return moves
      .filter(m => activeKeys.has(`${m.actor}:${m.name}`))
      .map(m => {
        const key = `${m.actor}:${m.name}`;
        const zoomedPercent = activeKeys.get(key) ?? m.percentage;
        return {
          ...m,
          percentage: zoomedPercent
        };
      });
  }, [moves, zoomedAnalysis.windowMoves]);

  // Format utility
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm" id="combat-analytics">
      {/* Chart Headers */}
      <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-700 pb-4 mb-5">
        <div>
          <h2 className="text-lg font-extrabold font-sans text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Combat Visual Analytics
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-450 mt-1">
            Analyzing <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{session.initiatorName}</span> against {session.targets.join(', ') || 'Sparring Target'}
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-750 w-full sm:w-fit">
          <button
            onClick={() => setActiveChart('timeline')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              activeChart === 'timeline'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/55 dark:hover:bg-slate-800'
            }`}
          >
            <Activity size={14} />
            Rolling {unitRateLabel}
          </button>
          <button
            onClick={() => setActiveChart('breakdown')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              activeChart === 'breakdown'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/55 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 size={14} />
            Move Split
          </button>
          <button
            onClick={() => setActiveChart('average')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              activeChart === 'average'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/55 dark:hover:bg-slate-800'
            }`}
          >
            <TrendingUp size={14} />
            Average {unitValueLabel}
          </button>
        </div>
      </div>

      {/* Interval Stats (Damage and Average DPS) displayed above Time Focus when an interval is selected */}
      {isZoomed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl shadow-sm">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block uppercase font-mono tracking-wider">Interval {unitValueLabel === 'Damage' ? 'Damage Per Second (DPS)' : `${unitValueLabel} Per Second (${unitRateLabel})`}</span>
              <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{formatNumber(zoomedAnalysis.windowDps)}/s</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl shadow-sm">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold block uppercase font-mono tracking-wider">Interval Total {unitValueLabel}</span>
              <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{formatNumber(zoomedAnalysis.windowTotalDamage)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub controls & interactive focus guides */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          {activeChart === 'breakdown' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mr-1">Stat Metric:</span>
              <button
                onClick={() => setBreakdownMetric('damage')}
                className={`px-2.5 py-1 text-xs font-bold rounded border transition-all cursor-pointer ${
                  breakdownMetric === 'damage'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/35'
                    : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                }`}
              >
                Total Damage
              </button>
              <button
                onClick={() => setBreakdownMetric('dps')}
                className={`px-2.5 py-1 text-xs font-bold rounded border transition-all cursor-pointer ${
                  breakdownMetric === 'dps'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/35'
                    : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                }`}
              >
                Damage Per Second (DPS)
              </button>
              <button
                onClick={() => setBreakdownMetric('average')}
                className={`px-2.5 py-1 text-xs font-bold rounded border transition-all cursor-pointer ${
                  breakdownMetric === 'average'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/35'
                    : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                }`}
              >
                Average Damage
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mr-1">Time Focus:</span>
              <button
                onClick={() => zoomToPreset('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded border transition-all cursor-pointer ${!isZoomed ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'}`}
              >
                Full duration
              </button>
              <button
                onClick={() => zoomToPreset('sustained')}
                className={`px-2.5 py-1 text-xs font-bold rounded border transition-all cursor-pointer ${(left === sustainedBounds.startSec && right === sustainedBounds.endSec) ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'}`}
                title="Sustained Damage window (start of first peak to end of final peak)"
              >
                Sustained Damage
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center self-end md:self-auto">
          {activeChart === 'breakdown' ? (
            <div className="flex justify-end gap-1 ">
              <button
                onClick={() => setChartSubtype('bar')}
                className={`p-1 px-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                  chartSubtype === 'bar'
                    ? 'bg-white dark:bg-slate-800 border-indigo-505/50 border-indigo-400 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Vertical Bars
              </button>

              <button
                onClick={() => setChartSubtype('horizontal')}
                className={`p-1 px-2.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                  chartSubtype === 'horizontal'
                    ? 'bg-white dark:bg-slate-800 border-indigo-505/50 border-indigo-400 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Horizontal Bars
              </button>
            </div>
          ) : (
            isZoomed && (
              <button
                onClick={() => zoomToPreset('all')}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold rounded-lg transition-all duration-200 border border-rose-200 dark:border-rose-955/30 bg-rose-50 dark:bg-rose-955/20 text-rose-600 dark:text-rose-450 hover:bg-rose-100/60 cursor-pointer"
              >
                <RotateCcw size={12} />
                Reset Focus Interval ({left}s - {right}s)
              </button>
            )
          )}
        </div>
      </div>

      {/* Streamlined Timeline Splicer & Trimmer Ribbon */}
      {isZoomed && onTrim && (
        <div className="mb-4 p-4 bg-indigo-50/75 dark:bg-indigo-950/25 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <Scissors size={14} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider">
                Interactive Timeline Splicer
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <span>Focused window <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-950 px-1 rounded">+{left}s to +{right}s</span> ({right - left}s selected). Click trim to crop the log here.</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              onClick={() => onTrim(session.id, left, right)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-all active:scale-95 border border-transparent"
              title="Trim the combat log to contain only this focused sequence"
            >
              <Scissors size={12} />
              Trim to Selection ({left}s - {right}s)
            </button>
          </div>
        </div>
      )}

      {/* Tip helper banner for timeline zoom */}
      {activeChart !== 'breakdown' && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 mb-4">
          <Info size={14} className="text-indigo-500 shrink-0" />
          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-sans leading-snug">
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">Interactive:</span> Drag horizontally over the graph to isolate and zoom into an action sequence. Hover points to analyze real-time move hits.
          </span>
        </div>
      )}

      {/* Main Chart Viewer */}
      <div className="w-full h-96 min-h-[400px] relative">
        <ResponsiveContainer width="100%" height="100%">
          {activeChart === 'breakdown' ? (
            chartSubtype === 'bar' ? (
              <BarChart data={breakdownData} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} className="dark:stroke-slate-700" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'semibold' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                  tickFormatter={(val) => val.length > 22 ? `${val.substring(0, 19)}...` : val}
                />
                <YAxis 
                  tickFormatter={formatNumber}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#f8fafc' }}
                  formatter={(value: any, name: any, props: any) => {
                    const label = 
                      name === 'damage' ? 'Total Damage' :
                      name === 'dps' ? 'Damage Per Second (DPS)' :
                      name === 'average' ? 'Average Damage' : name;
                    return [
                      <span className="text-slate-100 text-sm font-bold">{formatNumber(Number(value))} ({props.payload.critRate}% crit)</span>,
                      label
                    ];
                  }}
                />
                <Bar dataKey={breakdownMetric} radius={[4, 4, 0, 0]}>
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart 
                layout="vertical" 
                data={breakdownData} 
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} className="dark:stroke-slate-700" />
                <XAxis 
                  type="number"
                  tickFormatter={formatNumber}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  type="category"
                  dataKey="name" 
                  width={140}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'semibold' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => val.length > 22 ? `${val.substring(0, 19)}...` : val}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#f8fafc' }}
                  formatter={(value: any, name: any, props: any) => {
                    const label = 
                      name === 'damage' ? 'Total Damage' :
                      name === 'dps' ? 'Damage Per Second (DPS)' :
                      name === 'average' ? 'Average Damage' : name;
                    return [
                      <span className="text-slate-100 text-sm font-bold">{formatNumber(Number(value))} ({props.payload.critRate}% crit)</span>,
                      label
                    ];
                  }}
                />
                <Bar dataKey={breakdownMetric} radius={[0, 4, 4, 0]}>
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )
          ) : activeChart === 'average' ? (
            <AreaChart 
              data={timelineData} 
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <defs>
                <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} className="dark:stroke-slate-700 stroke-slate-200" />
              <XAxis 
                type="number"
                dataKey="secondNum" 
                domain={[left, right]}
                allowDataOverflow={true}
                tickFormatter={(val) => `${val}s`}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis 
                tickFormatter={formatNumber}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                content={<CombatCustomTooltip mode="average" session={session} activeMetric={activeMetric} />}
              />
              <Area 
                type="monotone" 
                dataKey="average" 
                stroke="#10b981" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorAverage)" 
              />
              {refLeft !== null && refRight !== null && (
                <RefArea 
                  x1={refLeft} 
                  x2={refRight} 
                  fill="#10b981" 
                  fillOpacity={0.15} 
                />
              )}
            </AreaChart>
          ) : (
            // Rolling DPS Timeline View
            <LineChart 
              data={timelineData} 
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} className="dark:stroke-slate-700 stroke-slate-200" />
              <XAxis 
                type="number"
                dataKey="secondNum" 
                domain={[left, right]}
                allowDataOverflow={true}
                tickFormatter={(val) => `${val}s`}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis 
                tickFormatter={formatNumber}
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                label={{ value: unitRateLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { textAnchor: 'middle' } }}
              />
              <Tooltip
                content={<CombatCustomTooltip mode="timeline" session={session} activeMetric={activeMetric} />}
              />
              <Line 
                type="monotone" 
                dataKey="rollingDps" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
                name={`Total ${unitRateLabel}`}
              />
              {/* Overlapping individual actions and moves */}
              {selectedOverlayKeys.map((key, idx) => {
                const parts = key.split(':');
                const moveName = parts.slice(1).join(':');
                const color = MOVE_COLORS[moveName] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                return (
                  <Line 
                    key={`overlay-${key}`}
                    type="monotone" 
                    dataKey={`rolling_${key}`} 
                    stroke={color} 
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                    name={moveName}
                  />
                );
              })}
              {refLeft !== null && refRight !== null && (
                <RefArea 
                  x1={refLeft} 
                  x2={refRight} 
                  fill="#6366f1" 
                  fillOpacity={0.15} 
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Interactive Legend Grid */}
      <div className="mt-4 border-t border-slate-200 dark:border-slate-700/60 pt-4">
        {activeChart === 'timeline' && (
          <p className="text-[10px] text-center text-indigo-600 dark:text-indigo-400 font-bold mb-3 uppercase tracking-wider">
            💡 Click an ability to overlay its live performance stream on the timeline chart
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center">
          {visibleMoves.map((entry, idx) => {
            const key = `${entry.actor}:${entry.name}`;
            const isSelected = selectedOverlayKeys.includes(key);
            const color = MOVE_COLORS[entry.name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            const displayName = entry.actor && entry.actor !== session.initiatorName 
              ? `${entry.name} (${entry.actor})`
              : entry.name;

            return (
              <button
                key={key}
                disabled={activeChart !== 'timeline'}
                onClick={() => {
                  if (isSelected) {
                     setSelectedOverlayKeys(selectedOverlayKeys.filter(k => k !== key));
                  } else {
                     setSelectedOverlayKeys([...selectedOverlayKeys, key]);
                  }
                }}
                className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition-all ${
                  activeChart === 'timeline' 
                    ? `cursor-pointer hover:scale-105 ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-805 dark:bg-slate-950 dark:border-indigo-550 dark:text-indigo-400 shadow-md ring-1 ring-indigo-500/20 dark:ring-indigo-500/45' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`
                    : 'bg-transparent border-transparent text-slate-400'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${isSelected ? 'animate-pulse' : ''}`} style={{ backgroundColor: color }} />
                <span>{displayName}</span>
                <span className="opacity-60 text-[10px]">({entry.percentage}%)</span>
                {activeChart === 'timeline' && isSelected && (
                  <span className="ml-1 text-[8px] bg-indigo-600 dark:bg-indigo-500 text-white font-black px-1 rounded uppercase">ON</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ROTATION MOVES SEQUENCE ANALYSIS DETAIL BLOCK */}
      {activeChart !== 'breakdown' && (
        <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Search size={16} className="text-indigo-500 shrink-0" />
                Detailed Interval Move Sequence & {unitRateLabel} Analysis
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-455 mt-1">
                Deep performance breakdown of combat activity locked within the focus range of <span className="font-bold text-indigo-500 font-mono">+{left}s</span> to <span className="font-bold text-indigo-500 font-mono">+{right}s</span> ({zoomedAnalysis.duration} seconds)
              </p>
            </div>
            <div className="shrink-0 text-right bg-indigo-50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-700 rounded-xl px-4.5 py-1.5 shadow-sm">
              <span className="text-[10px] text-slate-400 dark:text-slate-400 block uppercase font-mono font-bold">Portion of Total Run</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{zoomedAnalysis.damagePercentContribution}% Content</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Ability Breakdown inside the Zoomed Window */}
            <div className="lg:col-span-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4.5 rounded-xl space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Interval Move Split</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Distribution of {unitValueLabel.toLowerCase()} contributors inside this specific slot</p>
              </div>

               <div className="space-y-3 max-h-[305px] overflow-y-auto pr-1">
                {zoomedAnalysis.windowMoves.map((m, idx) => {
                  const color = MOVE_COLORS[m.moveName] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                  const displayName = m.actor && m.actor !== session.initiatorName 
                    ? `${m.moveName} (${m.actor})`
                    : m.moveName;
                  return (
                    <div key={`zoomed-move-${m.key}`} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block max-w-[170px]" title={displayName}>
                          {displayName}
                        </span>
                        <span className="font-mono text-slate-500 text-[11px] font-bold">
                          {formatNumber(m.totalDamage)} <span className="text-[10px] text-slate-400 font-normal">({m.percentage}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ backgroundColor: color, width: `${m.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {zoomedAnalysis.windowMoves.length === 0 && (
                  <div className="text-center py-10 text-xs italic text-slate-400">
                    No active abilities in this focused slot.
                  </div>
                )}
              </div>
            </div>

            {/* Chronological Active Combat Stream (Sequence) */}
            <div className="lg:col-span-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4.5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Rotation Activity Stream</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Chronological cast sequence order in this interval segment</p>
                </div>
                <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[9px] text-slate-500 dark:text-slate-450 font-bold uppercase tracking-wider font-mono">
                  CHRONO STREAM
                </div>
              </div>

              {/* Combat timeline logger node loop */}
              <div className="relative pl-4 space-y-4 max-h-[305px] overflow-y-auto pr-1">
                {/* Vertical guiding line */}
                <span className="absolute left-1.5 top-2 bottom-4 w-0.5 bg-slate-100 dark:bg-slate-800" />

                {zoomedAnalysis.combatEventsStream.map((event) => {
                  return (
                    <div key={`stream-sec-${event.secondNum}`} className="relative group animate-in fade-in slide-in-from-left-1 duration-150">
                      {/* Node Bullet */}
                      <span className="absolute -left-4 top-1 w-3.5 h-3.5 rounded-full border border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-slate-900">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      </span>

                      {/* Header row */}
                      <div 
                        className="flex items-center justify-between gap-2.5 mb-2 p-1 rounded-lg px-2 shadow-sm border bg-slate-50/70 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest font-mono text-indigo-600 dark:text-indigo-400">+{event.secondNum}s</span>
                          <span className="text-[9px] text-slate-400 font-mono">Second</span>
                        </div>
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 font-mono">
                          {formatNumber(event.totalDamage)} Damage
                        </span>
                      </div>

                      {/* Tick details */}
                      <div className="flex flex-wrap gap-1.5 pl-2">
                        {event.ticks.map((tick) => {
                          const color = MOVE_COLORS[tick.moveName] || '#94a3b8';
                          const name = tick.actor && tick.actor !== session.initiatorName
                            ? `${tick.moveName} (${tick.actor})`
                            : tick.moveName;
                          return (
                            <div 
                              key={`tick-${event.secondNum}-${tick.key}`}
                              className={`px-2 py-1 rounded text-[10px] inline-flex items-center gap-1.5 border transition-all ${
                                tick.isCrit 
                                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 font-extrabold shadow-sm' 
                                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/60 text-slate-650 dark:text-slate-300'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate max-w-[125px]" title={name}>
                                {name}
                              </span>
                              {tick.isCrit && (
                                <span className="text-[8px] bg-amber-400 dark:bg-amber-500 text-slate-950 font-black px-1 rounded uppercase tracking-wider shrink-0 scale-95 origin-left">CRIT</span>
                              )}
                              <span className="font-mono text-slate-450 dark:text-slate-400 font-extrabold">
                                {formatNumber(tick.damage)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {zoomedAnalysis.combatEventsStream.length === 0 && (
                  <div className="text-center py-16 text-slate-400 text-xs italic">
                    No timeline event data logged inside the current focus range. Try zooming into custom segments of active action.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
