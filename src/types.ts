export interface RawLogLine {
  timestamp: number; // in microseconds representing elapsed action time
  eventType: string; // e.g. "Damage Out", "Damage In", "Healing Out", "Supercharge Out", "Summary", etc.
  logText: string;   // human-readable description
  data: {
    clt?: number;    // event category
    itp?: number;
    iei?: string;    // initiator entity ID
    inm?: string;    // initiator name (e.g. "Experiment Z1")
    ivh?: number;    // initiator current health
    ivp?: number;    // initiator current power
    ivs?: number;    // initiator current supercharge / shield
    ttp?: number;    // target type
    tdi?: number;
    tei?: string;    // target entity ID
    tnm?: string;    // target name (e.g. "Sparring Target")
    tvh?: number;    // target current health
    tvp?: number;    // target current power
    tvs?: number;    // target current supercharge
    adi?: number;    // activity db index
    anm?: string;    // activity name / skill name
    vfi?: number;    // value / damage / healing float or int
  };
}

export interface MoveStats {
  name: string;
  totalDamage: number;
  percentage: number;
  hitCount: number;
  critCount: number;
  critRate: number;      // percentage (0-100)
  minHit: number;
  maxHit: number;
  avgHit: number;
  dps: number;
  actor: string;
}

export interface CombatAction {
  timestamp: number;
  actor: string;
  moveName: string;
  damage: number;
  isCrit: boolean;
  target: string;
  targetId?: string;
}

export interface TimePoint {
  timeInSeconds: number;       // relative time from start of combat
  rawTimestamp: number;        // microsecond raw timestamp
  damageSum: number;           // total damage done in this precise second (for spikes)
  healingSum: number;          // total healing done in this second
  cumulativeDamage: number;    // running sum of damage up to this second
  moves: Record<string, number>; // damage contributed by each move at this instant
  actions?: CombatAction[];    // chronological actions during this second
}

export interface SessionData {
  id: string;
  fileName: string;
  durationInSeconds: number;
  totalDamage: number;
  totalHealing: number;
  totalPower: number;
  overallDps: number;
  overallHps: number;
  critRate: number;
  hitCount: number;
  activeTargetCount: number;
  targets: string[];
  initiatorName: string;
  moves: MoveStats[];
  timeline: TimePoint[];
  rawLinesCount: number;
  rawLogs?: string[];
  allActions?: ParsedAction[];
}

export interface ParsedAction {
  timestamp: number;
  eventType: string; // e.g. 'Damage Out', 'Damage In', 'Healing Out', etc.
  actor: string;
  moveName: string;
  value: number;
  isCrit: boolean;
  target: string;
  targetId?: string;
}
