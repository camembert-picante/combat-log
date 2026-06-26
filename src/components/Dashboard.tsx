import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  UploadCloud, 
  Trash2, 
  Layers, 
  Search, 
  Sparkles, 
  FileText, 
  Flame, 
  Clock, 
  Award, 
  Zap, 
  Activity, 
  ArrowRight,
  TrendingUp,
  Shield,
  HelpCircle,
  FileCheck,
  Sun,
  Moon,
  Star,
  Edit3,
  Scissors,
  Plus,
  User,
  Target
} from 'lucide-react';
import { SessionData, MoveStats } from '../types';
import { parseLogFile, recomputeSessionFromTimeline, getMetricSessionData } from '../utils/parser';
import { SAMPLE_SESSIONS, generateRunLog } from '../data/samples';
import ChartSection from './ChartSection';
import MoveTable from './MoveTable';
import CompareView from './CompareView';
import TargetsSummary from './TargetsSummary';

const ThickHollowCross = ({ size = 14, className = "" }: { size?: number; className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M 8 3 h 8 v 5 h 5 v 8 h -5 v 5 h -8 v -5 h -5 v -8 h 5 Z" />
  </svg>
);

export default function Dashboard() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const validComparisonIds = useMemo(() => {
    const unique = Array.from(new Set(comparisonIds));
    return unique.filter(id => id && sessions.some(s => s.id === id));
  }, [comparisonIds, sessions]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'compare'>('single');
  const [customLogPaste, setCustomLogPaste] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    // Default to a premium night mode theme
    const saved = localStorage.getItem('theme');
    return saved !== null ? saved === 'dark' : true;
  });

  // Renaming states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Confirmation state for deleting all logs
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Zoom window boundary states for sync
  const [zoomLeft, setZoomLeft] = useState<number | undefined>(undefined);
  const [zoomRight, setZoomRight] = useState<number | undefined>(undefined);

  // Track body class for dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default sessions on startup
  useEffect(() => {
    const loaded = SAMPLE_SESSIONS.map(s => parseLogFile(s.rawText, s.name));
    setSessions(loaded);
    if (loaded.length > 0) {
      setSelectedSessionId(loaded[0].id);
      // Select first two by default for comparison
      setComparisonIds([loaded[0].id, loaded[1].id]);
    }
  }, []);

  const activeSession = sessions.find(s => s.id === selectedSessionId);

  // Synchronize zoom state when selected session changes
  useEffect(() => {
    if (activeSession) {
      setZoomLeft(0);
      setZoomRight(activeSession.durationInSeconds);
    } else {
      setZoomLeft(undefined);
      setZoomRight(undefined);
    }
  }, [selectedSessionId, activeSession?.durationInSeconds]);

  const getUniqueFileName = (name: string, existing: SessionData[]) => {
    let baseName = name;
    let extension = '';
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex !== -1 && lastDotIndex > 0) {
      baseName = name.substring(0, lastDotIndex);
      extension = name.substring(lastDotIndex);
    }
    
    let candidate = name;
    let counter = 1;
    while (existing.some(s => s.fileName === candidate)) {
      candidate = `${baseName} (${counter})${extension}`;
      counter++;
    }
    return candidate;
  };

  const handleRenameSave = (id: string, nameToSave?: string) => {
    const finalName = (nameToSave !== undefined ? nameToSave : editingName).trim();
    if (finalName) {
      setSessions(prev => {
        const uniqueName = getUniqueFileName(finalName, prev.filter(s => s.id !== id));
        return prev.map(s => s.id === id ? { ...s, fileName: uniqueName } : s);
      });
    }
    setEditingSessionId(null);
  };

  const handleTrimSession = (id: string, startSec: number, endSec: number) => {
    const sessionToTrim = sessions.find(s => s.id === id);
    if (!sessionToTrim) return;

    if (startSec < 0 || endSec > sessionToTrim.durationInSeconds || startSec >= endSec) {
      return;
    }

    const trimmedTimeline = sessionToTrim.timeline.filter(pt => pt.timeInSeconds >= startSec && pt.timeInSeconds <= endSec);
    if (trimmedTimeline.length === 0) {
      return;
    }

    // Shift seconds to start at 0s for the trimmed chunk, so it acts as standard run.
    const shiftedTimeline = trimmedTimeline.map(pt => ({
      ...pt,
      timeInSeconds: pt.timeInSeconds - startSec,
    }));

    setSessions(prev => {
      const draftName = `Trim - ${sessionToTrim.fileName} (${startSec}s-${endSec}s)`;
      const finalName = getUniqueFileName(draftName, prev);
      const trimmedSession = recomputeSessionFromTimeline(
        sessionToTrim,
        shiftedTimeline,
        finalName,
        "trimmed"
      );
      setSelectedSessionId(trimmedSession.id);
      setComparisonIds(compPrev => {
        if (compPrev.includes(trimmedSession.id)) return compPrev;
        return [...compPrev, trimmedSession.id];
      });
      return [trimmedSession, ...prev];
    });
  };

  const handleSplitSessionAtTime = (id: string, splitSec: number) => {
    const sessionToSplit = sessions.find(s => s.id === id);
    if (!sessionToSplit) return;

    if (splitSec < 1 || splitSec >= sessionToSplit.durationInSeconds) {
      return;
    }

    const t1 = sessionToSplit.timeline.filter(pt => pt.timeInSeconds <= splitSec);
    const t2 = sessionToSplit.timeline.filter(pt => pt.timeInSeconds > splitSec);

    if (t1.length === 0 || t2.length === 0) {
      return;
    }

    // Shift second part timeline to begin at 0s so it displays correctly as a separate segment
    const shiftedT2 = t2.map(pt => ({
      ...pt,
      timeInSeconds: pt.timeInSeconds - (splitSec + 1),
    }));

    setSessions(prev => {
      const name1 = getUniqueFileName(`${sessionToSplit.fileName} (Part 1 - 0s-${splitSec}s)`, prev);
      const part1 = recomputeSessionFromTimeline(
        sessionToSplit,
        t1,
        name1,
        "part1"
      );

      // Note: we must include part1's future name so it doesn't conflict with part2
      const tempSessions = [part1, ...prev];
      const name2 = getUniqueFileName(`${sessionToSplit.fileName} (Part 2 - ${splitSec + 1}s-${sessionToSplit.durationInSeconds}s)`, tempSessions);
      const part2 = recomputeSessionFromTimeline(
        sessionToSplit,
        shiftedT2,
        name2,
        "part2"
      );

      setSelectedSessionId(part1.id);
      setComparisonIds(compPrev => {
        const distinct = new Set([...compPrev, part1.id, part2.id]);
        return Array.from(distinct);
      });

      return [part1, part2, ...prev];
    });
  };


  // File Upload Handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  const processUploadedFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseLogFile(text, file.name);
        setSessions(prev => {
          const uniqueName = getUniqueFileName(parsed.fileName, prev);
          const withUniqueName = { ...parsed, fileName: uniqueName };
          return [withUniqueName, ...prev];
        });
        setSelectedSessionId(parsed.id);
        setComparisonIds(compPrev => compPrev.includes(parsed.id) ? compPrev : [...compPrev, parsed.id]);
      } catch (err) {
        alert("Failed to parse combat log. Please ensure it aligns with standard JSON log schemas.");
      }
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!customLogPaste.trim()) return;
    try {
      const defaultName = `Pasted Run #${sessions.length + 1}`;
      const uniqueName = getUniqueFileName(defaultName, sessions);
      const parsed = parseLogFile(customLogPaste, uniqueName);
      setSessions(prev => [parsed, ...prev]);
      setSelectedSessionId(parsed.id);
      setComparisonIds(compPrev => compPrev.includes(parsed.id) ? compPrev : [...compPrev, parsed.id]);
      setCustomLogPaste('');
      setShowPasteModal(false);
    } catch (err) {
      alert("Error parsing pasted logs. Make sure data contains standard timestamp/JSON formatting.");
    }
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setComparisonIds(prev => prev.filter(x => x !== id));
    if (selectedSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.length > 0) {
        setSelectedSessionId(remaining[0].id);
      } else {
        setSelectedSessionId('');
      }
    }
  };

  // Toggle run selection for comparison
  const toggleComparison = (id: string) => {
    setComparisonIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const [selectedActorFilter, setSelectedActorFilter] = useState('all');
  const [selectedTargetFilter, setSelectedTargetFilter] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('Damage Out');

  const activeMetricStyle = useMemo(() => {
    switch (selectedMetric) {
      case 'Damage Out':
        return {
          icon: <TrendingUp size={18} />,
          colorClasses: 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-450 border border-orange-100 dark:border-orange-900/10'
        };
      case 'Damage In':
        return {
          icon: <TrendingUp size={18} className="rotate-180 inline-block" />,
          colorClasses: 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border border-rose-100 dark:border-rose-900/30'
        };
      case 'Damage In (Shielded)':
        return {
          icon: <Shield size={18} className="inline-block" />,
          colorClasses: 'bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30'
        };
      case 'Healing Out':
        return {
          icon: <ThickHollowCross size={18} className="inline-block" />,
          colorClasses: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/30'
        };
      case 'Healing In':
        return {
          icon: <ThickHollowCross size={18} className="inline-block" />,
          colorClasses: 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-450 border border-teal-100 dark:border-teal-900/30'
        };
      case 'Power Out':
        return {
          icon: <Zap size={18} />,
          colorClasses: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30'
        };
      case 'Power In':
        return {
          icon: <Zap size={18} />,
          colorClasses: 'bg-violet-50 dark:bg-violet-950/20 text-violet-650 dark:text-violet-450 border border-violet-100 dark:border-violet-900/30'
        };
      case 'Supercharge Out':
        return {
          icon: <Flame size={18} />,
          colorClasses: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border border-amber-100 dark:border-amber-900/30'
        };
      case 'Supercharge In':
        return {
          icon: <Flame size={18} />,
          colorClasses: 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-450 border border-yellow-200/50 dark:border-yellow-900/30'
        };
      default:
        return {
          icon: <Zap size={18} />,
          colorClasses: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30'
        };
    }
  }, [selectedMetric]);

  const isHealing = selectedMetric.toLowerCase().includes('healing');
  const isPower = selectedMetric.toLowerCase().includes('power');
  const isSupercharge = selectedMetric.toLowerCase().includes('supercharge');
  const isInMetric = selectedMetric.endsWith('In') || selectedMetric.includes('In ');

  const unitRateLabel = isHealing ? 'HPS' : isPower ? 'PPS' : isSupercharge ? 'SPS' : 'DPS';
  const unitRateFullLabel = isHealing ? 'Heals Per Second' : isPower ? 'Power Per Second' : isSupercharge ? 'Supercharge Per Second' : 'Damage Per Second';
  const unitValueLabel = isHealing ? 'Healing' : isPower ? 'Power' : isSupercharge ? 'Supercharge' : 'Damage';

  // Reset filter when active session changes
  useEffect(() => {
    setSelectedActorFilter('all');
  }, [selectedSessionId]);

  // Reset target filter and actor filter when metric or active session changes
  useEffect(() => {
    setSelectedActorFilter('all');
    if (activeSession) {
      if (isInMetric) {
        setSelectedTargetFilter(activeSession.initiatorName);
      } else {
        setSelectedTargetFilter('all');
      }
    } else {
      setSelectedTargetFilter('all');
    }
  }, [selectedSessionId, selectedMetric, activeSession, isInMetric]);

  // Get unique actors for the active session based on selected metric
  const uniqueActors = activeSession?.allActions
    ? Array.from(new Set(activeSession.allActions.filter(act => {
        if (selectedMetric === 'Damage In (Shielded)') {
          return act.eventType === 'Damage In' || ((act.eventType === 'Healing In' || act.eventType === 'Healing Out') && act.moveName.endsWith(' (Shield)'));
        }
        return act.eventType === selectedMetric;
      }).map(act => act.actor)))
    : activeSession 
      ? Array.from(new Set(activeSession.moves.map(m => m.actor))) 
      : [];

  // Get unique targets for the active session based on selected metric
  const uniqueTargets = activeSession?.allActions
    ? Array.from(new Set(activeSession.allActions.filter(act => {
        if (selectedMetric === 'Damage In (Shielded)') {
          return act.eventType === 'Damage In' || ((act.eventType === 'Healing In' || act.eventType === 'Healing Out') && act.moveName.endsWith(' (Shield)'));
        }
        return act.eventType === selectedMetric;
      }).map(act => act.target)))
    : [];

  const getFilteredSessionData = (): SessionData | null => {
    if (!activeSession) return null;
    return getMetricSessionData(activeSession, selectedMetric, selectedActorFilter, selectedTargetFilter);
  };

  const filteredSession = getFilteredSessionData();

  // Filter skills by search query (match ability name OR player/actor name)
  const filteredMoves = filteredSession
    ? filteredSession.moves.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.actor && m.actor.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'} flex flex-col font-sans transition-colors duration-200`}>
      {/* 2. Top Header Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 dark:shadow-none">Ω</div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight text-slate-800 dark:text-slate-100">
                Combat log <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">analyzer</span>
              </h1>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono block tracking-wider uppercase font-bold">Odyssey Parse Engine</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Night mode toggle button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 mr-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer flex items-center justify-center h-9 w-9"
              aria-label="Toggle Night Mode"
              title={darkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
              id="theme-toggle-btn"
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              onClick={() => setShowPasteModal(true)}
              className="p-2 px-4 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer inline-flex items-center justify-center animate-none"
            >
              Paste Raw Log
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 px-4 h-9 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-xs font-bold text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-md shadow-indigo-100 dark:shadow-none flex items-center gap-2 transition-all cursor-pointer"
            >
              <UploadCloud size={14} />
              Upload Log
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".log,.txt" 
              className="hidden" 
            />
          </div>
        </div>
      </header>

      {/* 3. Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:px-8 space-y-6">
        
        {/* Sidebar & Core Panels row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT COLUMN: Manage Run Logs & Compare Checklist */}
          <div className="lg:col-span-1 space-y-6">
                       {/* Log Presets & Upload Manager */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400 mb-3 flex justify-between items-center">
                <span>Select active log</span>
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {sessions.map((s, index) => {
                  const isActive = s.id === selectedSessionId;
                  const isChecked = validComparisonIds.includes(s.id);

                  return (
                    <div 
                      key={s.id}
                      className={`group flex items-center justify-between p-3 rounded-xl transition-all ${
                        isActive 
                          ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-100 dark:shadow-none border border-transparent' 
                          : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-700/55 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {/* Checkbox for Compare, name for Active selection */}
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleComparison(s.id)}
                          className={`w-3.5 h-3.5 rounded cursor-pointer ${
                            isActive ? 'accent-white bg-white' : 'accent-indigo-600'
                          }`}
                          title="Select to compare side-by-side"
                        />
                        {editingSessionId === s.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSave(s.id);
                              } else if (e.key === 'Escape') {
                                setEditingSessionId(null);
                              }
                            }}
                            onBlur={() => handleRenameSave(s.id)}
                            className="text-xs p-1 rounded bg-white dark:bg-slate-700 text-slate-950 dark:text-white border-2 border-indigo-400 outline-none w-full font-bold focus:ring-1 focus:ring-indigo-450"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSessionId(s.id);
                              if (activeTab === 'compare') {
                                // remain in comparison mode
                              } else {
                                setActiveTab('single');
                              }
                            }}
                            onDoubleClick={() => {
                              setEditingSessionId(s.id);
                              setEditingName(s.fileName);
                            }}
                            className={`text-left text-xs font-bold truncate flex-1 cursor-pointer ${
                              isActive ? 'text-white font-extrabold' : 'text-slate-755 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-405'
                            }`}
                            title="Click to select, double-click to rename"
                          >
                            {s.fileName}
                          </button>
                        )}
                      </div>

                      {/* Explicit Rename Pencil & Delete Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(s.id);
                            setEditingName(s.fileName);
                          }}
                          className={`p-1 cursor-pointer transition ${
                            isActive ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-indigo-600'
                          }`}
                          title="Rename log file"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className={`p-1 cursor-pointer transition ${
                            isActive ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-rose-500'
                          }`}
                          title="Remove session"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {sessions.length === 0 && (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-400 text-xs">
                    No run logs loaded. Use presets or upload above.
                  </div>
                )}
              </div>

              {sessions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  {showClearConfirm ? (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-center space-y-2 animate-in fade-in zoom-in duration-150">
                      <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Delete all combat logs?</p>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setSessions([]);
                            setComparisonIds([]);
                            setSelectedSessionId('');
                            setShowClearConfirm(false);
                          }}
                          className="px-2.5 py-1 text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold rounded cursor-pointer transition"
                        >
                          Yes, Clear All
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="px-2.5 py-1 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-650 font-bold rounded cursor-pointer transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="w-full py-1.5 border border-rose-200 hover:border-rose-300 dark:border-rose-900/40 dark:hover:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-955/20 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} />
                      Delete All Logs
                    </button>
                  )}
                </div>
              )}

              {/* Incorporated Launch Comparison Button right below */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Selected runs:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full text-[10px]">
                    {validComparisonIds.length} checked
                  </span>
                </div>
                {validComparisonIds.length >= 2 ? (
                  <button
                    onClick={() => setActiveTab('compare')}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Layers size={13} />
                    Launch Comparison now
                  </button>
                ) : (
                  <div className="text-[10px] text-slate-400 dark:text-slate-400 text-center bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-2 rounded-xl">
                    Check 2+ logs above to compare
                  </div>
                )}
              </div>
            </div>

            {/* Combat Metric Selector Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-450">
                Display Metric Filter
              </h3>
              <div className="space-y-1.5 font-sans">
                {[
                  { id: 'Damage Out', label: 'Damage Out', icon: <TrendingUp size={14} />, bgActive: 'bg-orange-500/10 dark:bg-orange-950/20 text-orange-600 dark:text-orange-450 border border-orange-200/50 dark:border-orange-900/30' },
                  { id: 'Damage In', label: 'Damage In', icon: <TrendingUp size={14} className="rotate-180 inline-block" />, bgActive: 'bg-rose-500/10 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border border-rose-200/50 dark:border-rose-900/30' },
                  { id: 'Damage In (Shielded)', label: 'Damage In (Shielded)', icon: <Shield size={14} className="inline-block" />, bgActive: 'bg-pink-500/10 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 border border-pink-200/50 dark:border-pink-900/30' },
                  { id: 'Healing Out', label: 'Healing Out', icon: <ThickHollowCross size={14} className="inline-block" />, bgActive: 'bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border border-emerald-200/50 dark:border-emerald-900/30' },
                  { id: 'Healing In', label: 'Healing In', icon: <ThickHollowCross size={14} className="inline-block" />, bgActive: 'bg-teal-500/10 dark:bg-teal-950/20 text-teal-600 dark:text-teal-450 border border-teal-200/50 dark:border-teal-900/30' },
                  { id: 'Power Out', label: 'Power Out', icon: <Zap size={14} />, bgActive: 'bg-indigo-500/10 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30' },
                  { id: 'Power In', label: 'Power In', icon: <Zap size={14} />, bgActive: 'bg-violet-500/10 dark:bg-violet-950/20 text-violet-650 dark:text-violet-400 border border-violet-200/50 dark:border-violet-900/30' },
                  { id: 'Supercharge Out', label: 'Supercharge Out', icon: <Flame size={14} />, bgActive: 'bg-amber-500/10 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border border-amber-200/50 dark:border-amber-900/30' },
                  { id: 'Supercharge In', label: 'Supercharge In', icon: <Flame size={14} />, bgActive: 'bg-yellow-500/10 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-450 border border-yellow-250/50 dark:border-yellow-900/30' },
                ].map(metric => {
                  const isSelected = selectedMetric === metric.id;
                  return (
                    <button
                      key={metric.id}
                      onClick={() => setSelectedMetric(metric.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer ${
                        isSelected
                          ? metric.bgActive
                          : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-700/55 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {metric.icon}
                        <span>{metric.label}</span>
                      </div>
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0 animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Tab displays / Analytics */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Navigation Tabs */}
            <div className="flex border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm self-start gap-1 justify-start">
              <button
                onClick={() => setActiveTab('single')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'single'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Selected Run Dashboard
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all relative cursor-pointer ${
                  activeTab === 'compare'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Comparison Dashboard
                {validComparisonIds.length >= 2 && activeTab !== 'compare' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB VIEW 1: SINGLE LOG ANALYSIS */}
            {activeTab === 'single' && activeSession && filteredSession && (
              <div className="space-y-6">                {/* Source & Target Filter Dropdown Bar */}
                <div className="bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-slate-600 transition rounded-2xl p-5 shadow-sm space-y-4">
                  {/* Top: Header block containing text & icon */}
                  <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shrink-0">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Combat Log Filters</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-400">Filter stats, tables, and graphs by specific source (actor) and target</p>
                    </div>
                  </div>

                  {/* Bottom: Filters block in a grid, beautifully stacked and scaled */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Source Filter Dropdown */}
                    <div className="flex flex-col gap-2 bg-indigo-50/20 dark:bg-slate-900/40 border border-indigo-50/30 dark:border-slate-700 rounded-xl p-4 shadow-sm min-w-0">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider shrink-0">{unitValueLabel} Source:</span>
                      </div>
                      <select
                        value={selectedActorFilter}
                        onChange={(e) => setSelectedActorFilter(e.target.value)}
                        className="w-full max-w-full bg-white dark:bg-slate-800 border border-indigo-400 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30 transition cursor-pointer shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 font-sans min-w-0 truncate"
                      >
                        <option value="all">All Sources Combined</option>
                        {uniqueActors.map(actor => (
                          <option key={actor} value={actor} className="truncate">
                            👤 {actor === activeSession.initiatorName ? `${actor} (Player)` : `${actor} (Pet / Summon)`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target Filter Dropdown */}
                    <div className="flex flex-col gap-2 bg-indigo-50/20 dark:bg-slate-900/40 border border-indigo-50/30 dark:border-slate-700 rounded-xl p-4 shadow-sm min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Target size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider shrink-0">Target:</span>
                      </div>
                      <select
                        value={selectedTargetFilter}
                        onChange={(e) => setSelectedTargetFilter(e.target.value)}
                        className="w-full max-w-full bg-white dark:bg-slate-800 border border-indigo-400 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30 transition cursor-pointer shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 font-sans min-w-0 truncate"
                      >
                        <option value="all">All Targets Combined</option>
                        {uniqueTargets.map(target => (
                          <option key={target} value={target} className="truncate">
                            {target === activeSession.initiatorName ? `👤 ${target} (Player)` : `🎯 ${target}`}
                          </option>
                        ))}
                        {/* Fallback to ensure player is always selectable as an option */}
                        {!uniqueTargets.includes(activeSession.initiatorName) && (
                          <option value={activeSession.initiatorName}>
                            👤 {activeSession.initiatorName} (Player)
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4 Cards Summary Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  
                  {/* DPS CARD */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase font-sans block">Overall {unitRateLabel}</span>
                      <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100 font-sans">
                        {formatLargeNumber(Math.round(filteredSession.overallDps))}/s
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-xl ${activeMetricStyle.colorClasses}`}>
                      {activeMetricStyle.icon}
                    </div>
                  </div>

                  {/* DAMAGE CARD */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase font-sans block">Total {unitValueLabel}</span>
                      <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100 font-sans">
                        {formatLargeNumber(filteredSession.totalDamage)}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-xl ${activeMetricStyle.colorClasses}`}>
                      {activeMetricStyle.icon}
                    </div>
                  </div>

                  {/* CRIT RATE */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase font-sans block">{isHealing ? 'Heal Crit Rate' : 'Crit Rate'}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{filteredSession.critRate}%</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                      <Award size={18} />
                    </div>
                  </div>

                  {/* DURATION */}
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase font-sans block">Combat Time</span>
                      <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        {filteredSession.durationInSeconds}s
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                      <Clock size={18} />
                    </div>
                  </div>
                </div>

                {/* GRAPH SECTION / ANALYTICS CHART */}
                <ChartSection 
                  session={filteredSession} 
                  onTrim={handleTrimSession}
                  zoomLeft={zoomLeft}
                  zoomRight={zoomRight}
                  onZoomChange={(l, r) => {
                    setZoomLeft(l);
                    setZoomRight(r);
                  }}
                  activeMetric={selectedMetric}
                />

                {/* REDESIGNED ENEMIES & COMBAT TARGETS SUMMARY */}
                {selectedMetric !== 'Damage In' && selectedMetric !== 'Damage In (Shielded)' && selectedMetric !== 'Healing In' && selectedMetric !== 'Supercharge In' && (
                  <TargetsSummary 
                    session={filteredSession} 
                    zoomLeft={zoomLeft}
                    zoomRight={zoomRight}
                    activeMetric={selectedMetric}
                  />
                )}

                {/* Move stats sorting table */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-700/60 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <Star className="text-[#f6ca4c]" size={18} />
                          Move Breakdown Table
                        </h3>
                        <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Detailed statistical performance matrix of active abilities</p>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 rounded-full px-2.5 py-0.5 self-start sm:self-center">
                        {filteredMoves.length} active skills
                      </div>
                    </div>

                    {/* Search Field */}
                    <div className="relative min-w-[200px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter by ability or player..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs placeholder:text-slate-400 text-slate-700 dark:text-slate-350 focus:border-indigo-500 outline-none transition focus:bg-white dark:focus:bg-slate-900"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <MoveTable moves={filteredMoves} session={filteredSession} activeMetric={selectedMetric} />
                </div>

              </div>
            )}

            {/* TAB VIEW 2: RUN COMPARISON */}
            {activeTab === 'compare' && (
              <div key={validComparisonIds.join(',')}>
                {validComparisonIds.length < 2 ? (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-400 shadow-sm">
                    <Layers size={48} className="mx-auto text-slate-350 mb-3" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">Comparison Chamber Inactive</h3>
                    <p className="text-xs max-w-sm mx-auto leading-relaxed text-slate-400">
                      Check the boxes of at least two combat logs in the left sidebar to comparison trigger charts side-by-side.
                    </p>
                  </div>
                ) : (
                  <CompareView 
                    sessions={sessions
                      .filter(s => validComparisonIds.includes(s.id))
                      .map(s => getMetricSessionData(s, selectedMetric, selectedActorFilter, selectedTargetFilter))
                    } 
                    activeMetric={selectedMetric}
                  />
                )}
              </div>
            )}

            {sessions.length === 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm max-w-xl mx-auto animate-in fade-in duration-300">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700/60">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Quick Start Guide</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">Analyze your DCUO combat logs in 4 simple steps</p>
                  </div>
                </div>

                <div className="space-y-5 text-left font-sans">
                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                      <strong className="text-slate-800 dark:text-slate-200">Step 1:</strong> Enable Write Combat Logs to Disk in your DCUO game settings.
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                      <strong className="text-slate-800 dark:text-slate-200">Step 2:</strong> Find your log file (combat.log) in your PC's Documents folder under <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[11px] text-pink-600 dark:text-pink-400">My Games \ DC Universe Online \ Logs</code>.
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                      <strong className="text-slate-800 dark:text-slate-100">Step 3:</strong> (Optional) Delete or rename the old combat.log file if you want to start a completely fresh log.
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                      4
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                      <strong className="text-slate-800 dark:text-slate-200">Step 4:</strong> Click <strong className="text-indigo-600 dark:text-indigo-400">Upload a Log</strong> or use <strong className="text-indigo-600 dark:text-indigo-400">Paste a Log</strong> to view your analysis.
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 py-6 mt-12 text-center shadow-sm">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold font-mono">
          Odyssey parse engine v1 designed for DCUO logs
        </p>
      </footer>

      {/* PASTE MODAL */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/55 flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-800 dark:text-slate-100">Paste Raw Combat Log Lines</h3>
              <button 
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-semibold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Paste raw logs directly containing lines of microseconds-JSON, such as those generated by game clients.
              </p>
              
              <textarea
                value={customLogPaste}
                onChange={(e) => setCustomLogPaste(e.target.value)}
                placeholder='1782002938385436 {"clt": 1, "inm": "Experiment Z1", ...} [Damage Out] ...'
                rows={10}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs leading-relaxed font-mono placeholder:text-slate-400 text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none"
              />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/55 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3.5">
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-2 px-4 rounded-lg bg-transparent border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                className="p-2 px-5 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-xs font-semibold text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none transition cursor-pointer"
              >
                Analyze pasted logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers for metric extraction safely
const formatLargeNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString();
};
