import React, { useState, useMemo } from 'react';
import { ArrowUpDown, HelpCircle, Flame, Star, Maximize2, Search } from 'lucide-react';
import { MoveStats, SessionData } from '../types';

interface MoveTableProps {
  moves: MoveStats[];
  session?: SessionData;
  activeMetric?: string;
}

type SortField = 'name' | 'totalDamage' | 'percentage' | 'hitCount' | 'critRate' | 'avgHit' | 'dps';

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

export default function MoveTable({ moves, session, activeMetric = 'Damage Out' }: MoveTableProps) {
  const isHealing = activeMetric.toLowerCase().includes('healing');
  const isPower = activeMetric.toLowerCase().includes('power');
  const isSupercharge = activeMetric.toLowerCase().includes('supercharge');

  const unitRateLabel = isHealing ? 'HPS' : isPower ? 'PPS' : isSupercharge ? 'SPS' : 'DPS';
  const unitValueLabel = isHealing ? 'Healing' : isPower ? 'Power' : isSupercharge ? 'Supercharge' : 'Damage';

  const [sortField, setSortField] = useState<SortField>('totalDamage');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [isRawMode, setIsRawMode] = useState<boolean>(false);
  const [selectedMove, setSelectedMove] = useState<string | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState<string>('');
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedRawIndex, setSelectedRawIndex] = useState<number | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default desc
    }
  };

  const sortedMoves = [...moves].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    
    if (typeof aVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  // Switch toggle
  const handleToggleRaw = () => {
    const nextVal = !isRawMode;
    setIsRawMode(nextVal);
    if (nextVal && !selectedMove && sortedMoves.length > 0) {
      setSelectedMove(sortedMoves[0].name);
    }
  };

  const handleRowClick = (moveName: string) => {
    if (isRawMode) {
      setSelectedMove(moveName);
      setCustomSearchQuery('');
      setExpandedIndices({});
    }
  };

  const handleCopyLine = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const toggleRowExpand = (idx: number) => {
    setExpandedIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Find occurrences with original index reference
  const activeQuery = customSearchQuery || selectedMove || '';
  
  interface MatchItem {
    originalIndex: number;
    line: string;
  }
  
  // Filter raw log lines that match the active combat metric eventType (e.g. [Damage Out], [Healing Out], etc)
  const filteredRawLogs = useMemo(() => {
    const logs: MatchItem[] = [];
    const isShieldedMetric = activeMetric === 'Damage In (Shielded)';
    
    (session?.rawLogs || []).forEach((line, idx) => {
      if (isShieldedMetric) {
        if (line.includes('[Damage In]') || 
            ((line.includes('[Healing In]') || line.includes('[Healing Out]')) && line.toLowerCase().includes('absorbed'))) {
          logs.push({ originalIndex: idx, line });
        }
      } else {
        if (line.includes(`[${activeMetric}]`)) {
          logs.push({ originalIndex: idx, line });
        }
      }
    });
    return logs;
  }, [session?.rawLogs, activeMetric]);

  const matchItems = useMemo(() => {
    const items: MatchItem[] = [];
    filteredRawLogs.forEach(({ originalIndex, line }) => {
      if (activeQuery) {
        let isMatch = false;
        const lineLower = line.toLowerCase();
        const queryLower = activeQuery.toLowerCase();
        
        if (queryLower.endsWith(' (shield)')) {
          const baseQuery = queryLower.substring(0, queryLower.length - 9).trim();
          isMatch = lineLower.includes(baseQuery) && lineLower.includes('absorbed');
        } else if (activeMetric.toLowerCase().includes('healing')) {
          isMatch = lineLower.includes(queryLower) && !lineLower.includes('absorbed');
        } else {
          isMatch = lineLower.includes(queryLower);
        }
        
        if (isMatch) {
          items.push({ originalIndex, line });
        }
      }
    });
    return items;
  }, [filteredRawLogs, activeQuery, activeMetric]);

  const displayLimit = 100;
  const totalMatches = matchItems.length;
  const displayedMatches = matchItems.slice(0, displayLimit);

  const handleMatchClick = (originalIndex: number, idx: number) => {
    toggleRowExpand(idx);
    setSelectedRawIndex(originalIndex);
    
    // Smooth scroll the target inside the complete raw log viewer after a brief delay
    setTimeout(() => {
      const el = document.getElementById(`raw-log-line-${originalIndex}`);
      const container = document.getElementById('raw-log-scroll-container');
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        // Calculate relative position to scroll safely within the scroll container
        container.scrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
      }
    }, 80);
  };

  const handleMatchSeek = (originalIndex: number) => {
    setSelectedRawIndex(originalIndex);
    
    // Smooth scroll the target inside the complete raw log viewer after a brief delay
    setTimeout(() => {
      const el = document.getElementById(`raw-log-line-${originalIndex}`);
      const container = document.getElementById('raw-log-scroll-container');
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        // Calculate relative position to scroll safely within the scroll container
        container.scrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2) + (elRect.height / 2);
      }
    }, 80);
  };

  return (
    <div className="overflow-hidden mt-2" id="combat-move-table">
      {/* Mode Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 rounded-xl mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="p-1 px-2 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-750 dark:text-indigo-400 text-[10px] font-mono font-bold tracking-widest rounded-md uppercase">Log Search</span>
          <h4 className="text-slate-600 dark:text-slate-350 pr-1">
            {isRawMode 
              ? <span>Selected move is highlighted in log below. Click another row to inspect</span>
              : <span>Enable Raw log view to search for capability occurrences of specific moves</span>
            }
          </h4>
        </div>
        
        <button
          onClick={handleToggleRaw}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
            isRawMode
              ? 'bg-indigo-600 border-transparent text-white shadow ring-2 ring-indigo-500/10'
              : 'bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          {isRawMode ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Activate Raw Log View</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span>Activate Raw Log View</span>
            </span>
          )}
        </button>
      </div>



      <div className="overflow-x-auto font-sans w-full cursor-default select-none">
        <table className="w-full text-left border-collapse table-auto min-w-[520px] lg:min-w-0">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 font-sans font-black text-[9px] md:text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-2 px-1.5 w-10 text-center">Rank</th>
              <th className="py-2 px-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition" onClick={() => handleSort('name')}>
                Ability/Move <ArrowUpDown size={10} className="inline ml-0.5 text-slate-400" />
              </th>
              <th className="py-2 px-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition text-right" onClick={() => handleSort('totalDamage')}>
                {unitValueLabel} <ArrowUpDown size={10} className="inline ml-0.5 text-slate-400" />
              </th>
              <th className="py-2 px-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition text-right" onClick={() => handleSort('percentage')}>
                Split % <ArrowUpDown size={10} className="inline ml-0.5 text-slate-400" />
              </th>
              <th className="py-2 px-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition text-right" onClick={() => handleSort('dps')}>
                {unitRateLabel} <ArrowUpDown size={10} className="inline ml-0.5 text-slate-400" />
              </th>
              <th className="py-2 px-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition text-right" onClick={() => handleSort('hitCount')}>
                Hits <ArrowUpDown size={10} className="inline ml-0.5 text-slate-400" />
              </th>
              <th className="py-2 px-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition text-right" onClick={() => handleSort('critRate')}>
                Crit % <ArrowUpDown size={10} className="inline ml-0.5 text-slate-400" />
              </th>
              <th className="py-2 px-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition text-right" onClick={() => handleSort('avgHit')}>
                Avg/Max <ArrowUpDown size={10} className="inline ml-0.5 text-slate-400" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedMoves.map((m, idx) => {
              const weaponColor = MOVE_COLORS[m.name] || '#94a3b8';
              
              const isTopMove = m.percentage >= 30; // highlight top performing ability
              const rank = moves.findIndex(x => x.name === m.name) + 1;
              const formattedDamage = formatNumber(m.totalDamage);
              const isSelected = isRawMode && selectedMove === m.name;

              return (
                <tr 
                   key={`${m.actor}:${m.name}`} 
                   onClick={() => handleRowClick(m.name)}
                   className={`transition-colors text-slate-800 dark:text-slate-205 cursor-pointer ${
                     isSelected
                       ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                       : isRawMode
                         ? 'hover:bg-slate-50 dark:hover:bg-slate-800/20'
                         : isTopMove 
                           ? 'bg-indigo-50/10 dark:bg-indigo-950/10 hover:bg-slate-50 dark:hover:bg-slate-700/20' 
                           : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'
                   }`}
                >
                  {/* Rank */}
                  <td className="py-1.5 px-1.5 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {isSelected ? (
                      <span className="flex items-center justify-center w-5 h-5 mx-auto">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      </span>
                    ) : rank === 1 ? (
                      <span className="flex items-center justify-center w-5 h-5 mx-auto rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-black border border-amber-200 dark:border-amber-900/35 shadow-sm text-[10px]">
                        1
                      </span>
                    ) : rank === 2 ? (
                      <span className="flex items-center justify-center w-5 h-5 mx-auto rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border border-slate-200 dark:border-slate-700 text-[10px]">
                        2
                      </span>
                    ) : rank === 3 ? (
                      <span className="flex items-center justify-center w-5 h-5 mx-auto rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-900/35 text-[10px]">
                        3
                      </span>
                    ) : (
                      rank
                    )}
                  </td>

                  {/* Move Name */}
                  <td className="py-1.5 px-1.5 font-sans text-[11px] md:text-xs">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: weaponColor }} />
                        <span className="truncate max-w-[100px] sm:max-w-[130px] md:max-w-[170px] text-slate-900 dark:text-slate-100 font-bold" title={m.name}>{m.name}</span>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-indigo-500 dark:text-indigo-455 mt-0.5 pl-2.5 uppercase">
                        {m.actor}
                      </span>
                    </div>
                  </td>

                  {/* Total Damage */}
                  <td className="py-1.5 px-1.5 font-mono text-right text-slate-850 dark:text-slate-100 font-bold text-[11px] md:text-xs">
                    {formattedDamage}
                  </td>

                  {/* Split Percentage */}
                  <td className="py-1.5 px-1.5 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-[11px] md:text-xs text-slate-800 dark:text-slate-100 font-bold">{m.percentage}%</span>
                      {/* Sub progress loader bar */}
                      <div className="w-10 bg-slate-100 dark:bg-slate-900/80 h-1 rounded-full mt-0.5 overflow-hidden hidden lg:block">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ width: `${m.percentage}%`, backgroundColor: weaponColor }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* DPS Contribution */}
                  <td className="py-1.5 px-1.5 font-mono text-right font-bold text-slate-800 dark:text-slate-100 text-[11px] md:text-xs">
                    {formatNumber(Math.round(m.dps))}/s
                  </td>

                  {/* Hit Count */}
                  <td className="py-1.5 px-1.5 font-mono text-right text-slate-500 dark:text-slate-400 font-semibold text-[10px] md:text-[11px]">
                    {m.hitCount}
                  </td>

                  {/* Crit Rate */}
                  <td className="py-1.5 px-1.5 text-right">
                    <span 
                      className={`font-mono font-bold rounded px-1 py-0.5 text-[9px] md:text-[10px] ${
                        m.critRate >= 50 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' 
                          : m.critRate >= 25 
                          ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30' 
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {m.critRate}%
                    </span>
                  </td>

                  {/* Avg / Max */}
                  <td className="py-1.5 px-1.5 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[10px] md:text-[11px]">{formatNumber(m.avgHit)}</span>
                      <span className="font-mono text-[8px] text-slate-450 dark:text-slate-400 font-bold">max: {formatNumber(m.maxHit)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Raw Combat Log Automated Search Panel */}
      {isRawMode && (
        <div className="mt-5 border border-indigo-150 dark:border-indigo-950/65 bg-indigo-50/15 dark:bg-slate-900/30 rounded-2xl p-4 animate-in fade-in duration-250">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-505 bg-indigo-500 animate-pulse" />
                  Log Search Matches
                </h4>
                <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-bold font-mono text-[10px] rounded">
                  {totalMatches} found
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-400 mt-1 font-sans">
                Searching for occurrences of "<span className="font-bold text-indigo-650 dark:text-indigo-350">{activeQuery}</span>". Click any match or timestamp to scroll the Raw Log list below directly to that line.
              </p>
            </div>

            {/* Custom Log Query override */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 text-slate-400" size={12} />
              <input
                type="text"
                value={customSearchQuery || (selectedMove ? selectedMove : '')}
                onChange={(e) => setCustomSearchQuery(e.target.value)}
                placeholder="Type custom search term..."
                className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs placeholder:text-slate-400 text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none transition"
              />
              {(customSearchQuery || selectedMove) && (
                <button 
                  onClick={() => { setCustomSearchQuery(''); setSelectedMove(null); }}
                  className="absolute right-2.5 top-2.5 bg-transparent border-0 text-slate-400 hover:text-slate-600 cursor-pointer pt-0.5"
                  title="Clear search"
                >
                  <span className="text-[10px]">✕</span>
                </button>
              )}
            </div>
          </div>

          {displayedMatches.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <p className="text-xs font-mono text-slate-400">No raw log lines matched your criteria.</p>
              <button 
                onClick={() => { setCustomSearchQuery(''); if (moves.length > 0) setSelectedMove(moves[0].name); }}
                className="mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 underline"
              >
                Reset filter to top ability
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1.5 mb-6">
              {displayedMatches.map(({ line, originalIndex }, idx) => {
                const spaceIdx = line.indexOf(' ');
                let timestamp = 0;
                let remainder = line;
                if (spaceIdx !== -1) {
                  timestamp = parseInt(line.substring(0, spaceIdx), 10);
                  remainder = line.substring(spaceIdx + 1);
                }
                
                // Calculate relative microsecond offset
                const startTimestamp = session?.timeline[0]?.rawTimestamp || 0;
                const elapsedMicros = timestamp - startTimestamp;
                const elapsedSecsStr = elapsedMicros > 0 ? `+${(elapsedMicros / 1000000).toFixed(3)}s` : '0.000s';
                
                // Extract event metadata
                let jsonStr = '';
                const jsonStart = remainder.indexOf('{');
                const jsonEnd = remainder.lastIndexOf('}');
                let eventType = 'Combat Event';
                let textPortion = remainder;
                let jsonObj: any = null;

                if (jsonStart !== -1 && jsonEnd !== -1) {
                  jsonStr = remainder.substring(jsonStart, jsonEnd + 1);
                  try {
                    const preprocessedJsonStr = jsonStr.replace(/"(iei|tei)":\s*(\d+)/g, '"$1": "$2"');
                    jsonObj = JSON.parse(preprocessedJsonStr);
                  } catch (e) {}
                  
                  const afterJson = remainder.substring(jsonEnd + 1).trim();
                  const bracketMatch = afterJson.match(/^\[(.*?)\]\s*(.*)$/);
                  if (bracketMatch) {
                    eventType = bracketMatch[1];
                    textPortion = bracketMatch[2];
                  } else {
                    textPortion = afterJson;
                  }
                }

                const isExpanded = !!expandedIndices[idx];
                const badgeColor = 
                  eventType.includes('Damage Out') ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50' :
                  eventType.includes('Healing') ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50' :
                  eventType.includes('Supercharge') ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/50' :
                  'bg-slate-55 bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800';

                return (
                  <div 
                    key={idx} 
                    className={`border border-slate-150 dark:border-slate-800/80 rounded-xl transition-all ${
                      isExpanded 
                        ? 'bg-white dark:bg-slate-950 shadow-sm ring-1 ring-indigo-550/20' 
                        : 'bg-slate-50 hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-950'
                    }`}
                  >
                    {/* Header trigger bar */}
                    <div 
                      onClick={() => handleMatchSeek(originalIndex)}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none text-[11px]"
                    >
                      <div className="flex items-start sm:items-center gap-2 font-mono">
                        <span 
                          className="text-indigo-600 dark:text-indigo-400 font-extrabold w-[72px] shrink-0 hover:underline bg-indigo-50 dark:bg-indigo-950/60 py-0.5 px-1.5 rounded text-center tracking-tighter"
                          title="Click to seek log to this point"
                        >
                          {elapsedSecsStr}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${badgeColor} shrink-0`}>
                          {eventType}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-sans max-w-[280px] sm:max-w-md truncate" title={textPortion}>
                          {textPortion}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto text-slate-400 font-mono text-[10px]">
                        {jsonObj?.vfi !== undefined && (
                          <span className="font-black text-indigo-650 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1 rounded">
                            {jsonObj.vfi.toLocaleString()}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleCopyLine(line, idx); }}
                            className="p-1 text-[9px] font-sans font-bold hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                            title="Copy full raw log line"
                          >
                            {copiedIndex === idx ? (
                              <span className="text-emerald-600 font-bold">Copied!</span>
                            ) : (
                              <span>Copy</span>
                            )}
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMatchClick(originalIndex, idx);
                            }}
                            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-650 dark:hover:text-indigo-400 cursor-pointer bg-transparent border-none p-0 outline-none"
                          >
                            {isExpanded ? 'Hide ▲' : 'Show ▼'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Collapsible raw details payload */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-850 bg-slate-50/75 dark:bg-slate-900/25 rounded-b-xl text-[11px] font-mono select-text">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-slate-400 border-b border-dashed border-slate-200 dark:border-slate-800 pb-1">
                          <span>Raw JSON Event Details</span>
                          <span>Timestamp: {timestamp} μs</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5 pt-1 text-slate-600 dark:text-slate-350">
                          {jsonObj && Object.entries(jsonObj).map(([key, val]) => {
                            let label = key;
                            if (key === 'clt') label = 'clt (Category)';
                            if (key === 'inm') label = 'inm (Initiator)';
                            if (key === 'tnm') label = 'tnm (Target)';
                            if (key === 'anm') label = 'anm (Ability)';
                            if (key === 'vfi') label = 'vfi (Value)';
                            if (key === 'tvh') label = 'tvh (Target HP)';
                            
                            return (
                              <div key={key} className="flex gap-1 border-b border-slate-100/40 dark:border-slate-800/40 pb-1">
                                <span className="text-indigo-600/70 dark:text-indigo-400/75 font-semibold shrink-0 uppercase text-[9px] md:text-[10px]">{label}:</span>
                                <span className="text-slate-800 dark:text-slate-200 font-extrabold truncate" title={String(val)}>
                                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {totalMatches > displayLimit && (
                <p className="text-center font-bold text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                  Showing top 100 matches out of {totalMatches} total. Narrow your search with the custom query filter above to see more specific subsets.
                </p>
              )}
            </div>
          )}

          {/* Full Raw Scrollable Log List Browser */}
          <div className="mt-4 border border-slate-250 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-sans text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="font-bold">Full Raw Log File ({activeMetric})</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500 font-bold uppercase">
                {filteredRawLogs.length} Total Lines
              </span>
            </div>

            <div 
              id="raw-log-scroll-container"
              className="overflow-y-auto max-h-72 p-3 font-mono text-[11px] space-y-1 bg-slate-950 dark:bg-slate-950 select-text scroll-smooth"
            >
              {filteredRawLogs.map(({ originalIndex: fullIdx, line }, displayIdx) => {
                const spaceIdx = line.indexOf(' ');
                let timestamp = 0;
                let remainder = line;
                if (spaceIdx !== -1) {
                  timestamp = parseInt(line.substring(0, spaceIdx), 10);
                  remainder = line.substring(spaceIdx + 1);
                }

                const startTimestamp = session?.timeline[0]?.rawTimestamp || 0;
                const elapsedMicros = timestamp - startTimestamp;
                const elapsedSecsStr = elapsedMicros > 0 ? `+${(elapsedMicros / 1000000).toFixed(3)}s` : '0.000s';

                const isCurrentlySeeked = selectedRawIndex === fullIdx;

                return (
                  <div 
                    key={fullIdx}
                    id={`raw-log-line-${fullIdx}`}
                    onClick={() => setSelectedRawIndex(fullIdx)}
                    className={`flex items-start py-1 px-2 rounded cursor-pointer transition-all border-l-2 ${
                      isCurrentlySeeked
                        ? 'bg-indigo-950/65 dark:bg-indigo-950/80 text-white font-extrabold border-indigo-500 shadow-sm'
                        : 'border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-350'
                    }`}
                  >
                    <span className="text-[10px] text-slate-600 mr-3 w-8 select-none text-right shrink-0" title={`Line ${fullIdx + 1} in raw file`}>
                      {displayIdx + 1}
                    </span>
                    <span className="text-[10.5px] text-indigo-400/85 mr-3 select-none shrink-0 w-16 font-semibold">
                      {elapsedSecsStr}
                    </span>
                    <span className="break-all whitespace-pre-wrap flex-1">
                      {remainder}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
