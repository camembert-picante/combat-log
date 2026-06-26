import React, { useState, useMemo } from 'react';
import { Target, ChevronDown, ChevronUp } from 'lucide-react';
import { SessionData } from '../types';

interface TargetsSummaryProps {
  session: SessionData;
  zoomLeft?: number;
  zoomRight?: number;
  activeMetric?: string;
}

export default function TargetsSummary({ session, zoomLeft, zoomRight, activeMetric = 'Damage Out' }: TargetsSummaryProps) {
  const isHealing = activeMetric.toLowerCase().includes('healing');
  const isPower = activeMetric.toLowerCase().includes('power');
  const isSupercharge = activeMetric.toLowerCase().includes('supercharge');

  const unitRateLabel = isHealing ? 'HPS' : isPower ? 'PPS' : isSupercharge ? 'SPS' : 'DPS';
  const unitValueLabel = isHealing ? 'Healing' : isPower ? 'Power' : isSupercharge ? 'Supercharge' : 'Damage';

  // State to track expanded target keys
  const [expandedTargets, setExpandedTargets] = useState<Record<string, boolean>>({});
  
  // Collapsible dropdown state, default hidden
  const [isOpen, setIsOpen] = useState(false);

  const targetStats = useMemo(() => {
    if (!session || !session.timeline) return [];

    const entityMap: Record<string, string[]> = {}; // targetName -> unique targetIds in order of hit
    const actionsList: any[] = [];

    session.timeline.forEach(pt => {
      // Respect zoom boundaries
      if (typeof zoomLeft === 'number' && pt.timeInSeconds < zoomLeft) return;
      if (typeof zoomRight === 'number' && pt.timeInSeconds > zoomRight) return;

      if (!pt.actions) return;
      pt.actions.forEach(act => {
        if (!act.target || act.damage <= 0) return;
        actionsList.push(act);

        const name = act.target;
        const id = act.targetId || 'unknown';
        if (!entityMap[name]) {
          entityMap[name] = [];
        }
        if (!entityMap[name].includes(id)) {
          entityMap[name].push(id);
        }
      });
    });

    const tallies: Record<string, {
      id: string;
      name: string;
      entityLabel: string;
      totalDamage: number;
      hitCount: number;
    }> = {};

    let overallDamage = 0;

    actionsList.forEach(act => {
      const name = act.target;
      const id = act.targetId || 'unknown';
      const key = `${name}###${id}`;

      if (!tallies[key]) {
        const idx = entityMap[name].indexOf(id) + 1;
        // If there is only 1 entity for this name, list only name. Otherwise add a sequential #.
        const entityLabel = entityMap[name].length > 1 ? `${name} #${idx}` : name;

        tallies[key] = {
          id,
          name,
          entityLabel,
          totalDamage: 0,
          hitCount: 0
        };
      }

      tallies[key].totalDamage += act.damage;
      tallies[key].hitCount += 1;
      overallDamage += act.damage;
    });

    // Compute duration inside active zoom
    let duration = session.durationInSeconds || 1;
    if (typeof zoomLeft === 'number' && typeof zoomRight === 'number') {
      duration = Math.max(1, zoomRight - zoomLeft);
    }

    return Object.values(tallies).map(t => {
      const percentage = overallDamage > 0 ? Number(((t.totalDamage / overallDamage) * 100).toFixed(1)) : 0;
      const dps = Number((t.totalDamage / duration).toFixed(1));
      const avgDamage = t.hitCount > 0 ? Math.round(t.totalDamage / t.hitCount) : 0;

      return {
        ...t,
        percentage,
        dps,
        avgDamage
      };
    }).sort((a, b) => b.totalDamage - a.totalDamage);
  }, [session, zoomLeft, zoomRight]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const toggleTargetExpand = (key: string) => {
    setExpandedTargets(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (targetStats.length === 0) return null;

  const totalEnemies = targetStats.length;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm mb-6 animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
      {/* Collapsible Dropdown Header Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-50/50 dark:hover:bg-slate-750/30 transition text-left outline-none cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 shrink-0">
            <Target size={20} className={isOpen ? "animate-pulse" : ""} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Targets Summary
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-505">
                ({totalEnemies} {totalEnemies === 1 ? 'target' : 'targets'})
              </span>
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
              Click card for detailed stats
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="text-xs font-bold font-mono uppercase bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 px-2.5 py-1 rounded-md">
            {isOpen ? 'Hide Targets' : 'Show Targets'}
          </span>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Grid of Targets layout (Rendered conditionally based on isOpen) */}
      {isOpen && (
        <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-700/60 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {targetStats.map((target) => {
              const cardKey = `${target.id}_${target.entityLabel}`;
              const isExpanded = !!expandedTargets[cardKey];

              return (
                <div
                  key={cardKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTargetExpand(cardKey);
                  }}
                  className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200/60 dark:border-slate-805/80 transition-all hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm cursor-pointer flex flex-col justify-between selection:bg-transparent"
                  title={`Click to toggle ${unitRateLabel} & Average hit details`}
                >
                  <div>
                    {/* Header Info */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 block truncate" title={target.entityLabel}>
                        🎯 {target.entityLabel}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded tracking-wide">
                          {target.percentage}% Split
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={14} className="text-slate-450 dark:text-slate-400" />
                        ) : (
                          <ChevronDown size={14} className="text-slate-450 dark:text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Progress split bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${target.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics division */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/60 text-xs">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-505 block mb-0.5">{unitValueLabel} Dealt</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm">
                        {formatNumber(target.totalDamage)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-505 block mb-0.5">Hits Received</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm">
                        {target.hitCount}
                      </span>
                    </div>
                  </div>

                  {/* Extended Info on toggle */}
                  {isExpanded && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/60 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-550 block mb-0.5">{unitValueLabel} / Sec</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNumber(target.dps)}/s
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-550 block mb-0.5">Average Hit</span>
                        <span className="font-mono font-bold text-amber-500 dark:text-amber-400">
                          {formatNumber(target.avgDamage)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
