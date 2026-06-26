import { parseLogFile } from '../utils/parser';
import { SAMPLE_USER_LOG } from './user_log';

// Programmatically generate realistic combat logs of different playstyles/builds!
// This satisfies the token limit constraints while delivering massive, high-fidelity datasets.

interface LogLineOpts {
  clt: number;
  anm: string;
  vfi: number;
  isCrit?: boolean;
  type?: 'Damage Out' | 'Healing Out' | 'Supercharge Out' | 'Combat Out' | 'Power Out';
  target?: string;
}

function createLogLine(timestamp: number, opts: LogLineOpts): string {
  const { clt, anm, vfi, isCrit = false, type = 'Damage Out', target = 'Sparring Target' } = opts;
  
  const payload = {
    clt,
    itp: 0,
    iei: '8609530557311875635',
    inm: 'Experiment Z1',
    ivh: 1440354,
    ivp: 600778,
    ivs: 900,
    ttp: 2,
    tdi: 922888370,
    tei: '8609530849369613616',
    tnm: target,
    tvh: 24000000 - Math.floor(vfi * 3),
    tvp: 10000,
    vfi: vfi,
    anm: anm,
    adi: 928025000 + Math.floor(Math.random() * 1000)
  };

  let actionText = '';
  if (type === 'Damage Out') {
    actionText = isCrit 
      ? `Experiment Z1's ${anm} critically damaged ${target} for ${vfi}`
      : `Experiment Z1's ${anm} damaged ${target} for ${vfi}`;
  } else if (type === 'Healing Out') {
    actionText = `Experiment Z1's ${anm} healed Experiment Z1 for ${vfi}`;
  } else if (type === 'Supercharge Out') {
    actionText = `Experiment Z1's ${anm} healed Experiment Z1 for ${vfi} Supercharge`;
  } else if (type === 'Power Out') {
    actionText = `Experiment Z1's ${anm} healed Experiment Z1 for ${vfi} Power`;
  } else {
    actionText = `Experiment Z1's ${anm} performed action on ${target}`;
  }

  return `${timestamp} ${JSON.stringify(payload)} [${type}] ${actionText}`;
}

export function generateRunLog(build: 'shuriken' | 'meteor' | 'fire', durationSec = 30): string {
  const lines: string[] = [];
  let currentTimestamp = 1782002938000000; // Base microsecond timestamp

  // Populate first setup line
  lines.push(`${currentTimestamp} {} [Combat Out] Experiment Z1 entered combat with Sparring Target`);

  const activeSkills: Array<{
    name: string;
    cooldownMs: number;
    baseDamage: number;
    variance: number;
    critRate: number;
    clt: number;
    evtType: 'Damage Out' | 'Healing Out' | 'Supercharge Out' | 'Power Out';
    lastCast: number;
  }> = [];

  if (build === 'shuriken') {
    activeSkills.push(
      { name: 'Shuriken Storm Mastery', cooldownMs: 800, baseDamage: 22000, variance: 4000, critRate: 0.50, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Clap Mastery', cooldownMs: 3000, baseDamage: 18000, variance: 3000, critRate: 0.30, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Recovery', cooldownMs: 2500, baseDamage: 45, variance: 10, critRate: 0.05, clt: 4, evtType: 'Supercharge Out', lastCast: 0 },
      { name: 'Sunstone Helix Spike', cooldownMs: 5000, baseDamage: 95000, variance: 15000, critRate: 0.40, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Equilibrium', cooldownMs: 12000, baseDamage: 540000, variance: 80000, critRate: 0.60, clt: 1, evtType: 'Damage Out', lastCast: 0 }
    );
  } else if (build === 'meteor') {
    activeSkills.push(
      { name: 'Meteor Strike', cooldownMs: 1500, baseDamage: 45000, variance: 9000, critRate: 0.45, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Detonate', cooldownMs: 4000, baseDamage: 85000, variance: 12000, critRate: 0.40, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Stoke Flames', cooldownMs: 2000, baseDamage: 12000, variance: 2000, critRate: 0.35, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Clap Mastery', cooldownMs: 3500, baseDamage: 19000, variance: 2000, critRate: 0.25, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Recovery', cooldownMs: 3000, baseDamage: 2400, variance: 400, critRate: 0.10, clt: 3, evtType: 'Power Out', lastCast: 0 }
    );
  } else {
    // Fire Tick build
    activeSkills.push(
      { name: 'Overheat', cooldownMs: 600, baseDamage: 16000, variance: 2000, critRate: 0.35, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Stoke Flames', cooldownMs: 1200, baseDamage: 24000, variance: 3000, critRate: 0.55, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Detonate', cooldownMs: 6000, baseDamage: 90000, variance: 10000, critRate: 0.45, clt: 1, evtType: 'Damage Out', lastCast: 0 },
      { name: 'Immolation', cooldownMs: 5000, baseDamage: 72000, variance: 5000, critRate: 0.10, clt: 2, evtType: 'Healing Out', lastCast: 0 }
    );
  }

  // Iterate millisecond by millisecond
  const totalMs = durationSec * 1000;
  for (let ms = 0; ms <= totalMs; ms += 250) { // check actions every 250ms
    const timestamp = currentTimestamp + ms * 1000;
    
    activeSkills.forEach(skill => {
      if (ms - skill.lastCast >= skill.cooldownMs) {
        // Trigger action!
        const isCrit = Math.random() < skill.critRate;
        const multiplier = isCrit ? 2.0 : 1.0;
        const value = Math.round((skill.baseDamage + (Math.random() * 2 - 1) * skill.variance) * multiplier);
        
        lines.push(createLogLine(timestamp, {
          clt: skill.clt,
          anm: skill.name,
          vfi: value,
          isCrit,
          type: skill.evtType
        }));
        
        skill.lastCast = ms;
      }
    });

    // Add realistic incoming background events for full filter coverage!
    if (ms > 0 && ms % 1500 === 0) {
      // Damage In (e.g. Boss "Cosmic Overlord" attacks the player "Experiment Z1")
      const bossAttack = ms % 3000 === 0 ? 'Heavy Smash' : 'Void Burst';
      const dmgInValue = Math.round(12000 + Math.random() * 6000);
      lines.push(`${timestamp} ${JSON.stringify({
        clt: 1,
        inm: 'Cosmic Overlord',
        tei: '8609530557311875635',
        tnm: 'Experiment Z1',
        vfi: dmgInValue,
        anm: bossAttack
      })} [Damage In] Cosmic Overlord's ${bossAttack} damaged Experiment Z1 for ${dmgInValue}`);

      // Healing In (e.g. Companion healer restores health to "Experiment Z1")
      const healInValue = Math.round(3500 + Math.random() * 1500);
      lines.push(`${timestamp} ${JSON.stringify({
        clt: 2,
        inm: 'Aura Healer v2',
        tei: '8609530557311875635',
        tnm: 'Experiment Z1',
        vfi: healInValue,
        anm: 'Nano Care'
      })} [Healing In] Aura Healer v2's Nano Care healed Experiment Z1 for ${healInValue}`);
    }

    if (ms > 0 && ms % 2500 === 0) {
      // Power In (e.g. Power Grid batteries recharge the player's core)
      const powerInValue = Math.round(180 + Math.random() * 90);
      lines.push(`${timestamp} ${JSON.stringify({
        clt: 3,
        inm: 'Power Grid',
        tei: '8609530557311875635',
        tnm: 'Experiment Z1',
        vfi: powerInValue,
        anm: 'Core Discharge'
      })} [Power In] Power Grid's Core Discharge restored ${powerInValue} Power to Experiment Z1`);

      // Supercharge In (e.g. Kinetic shock timers restore Supercharge points)
      const scInValue = Math.round(30 + Math.random() * 15);
      lines.push(`${timestamp} ${JSON.stringify({
        clt: 4,
        inm: 'Skill Synergy',
        tei: '8609530557311875635',
        tnm: 'Experiment Z1',
        vfi: scInValue,
        anm: 'Kinetic Charge'
      })} [Supercharge In] Skill Synergy's Kinetic Charge restored ${scInValue} Supercharge to Experiment Z1`);
    }
  }

  // Add final Summary line mimicking original files
  const finalTime = currentTimestamp + totalMs * 1000;
  const dmgStats = lines.filter(l => l.includes('Damage Out')).map(l => {
    const valMatch = l.match(/for (\d+)/);
    return valMatch ? parseInt(valMatch[1], 10) : 0;
  });
  
  const sumDmg = dmgStats.reduce((a, b) => a + b, 0);
  const avgDps = Math.round(sumDmg / durationSec);
  const maxHit = dmgStats.length > 0 ? Math.max(...dmgStats) : 0;
  const crits = lines.filter(l => l.includes('critically damaged')).length;
  const critRatePercent = dmgStats.length > 0 ? ((crits / dmgStats.length) * 100).toFixed(1) : '0.0';

  lines.push(`${finalTime} [Summary] Damage [${durationSec.toFixed(1)}s] ${avgDps}/s - ${sumDmg} total - ${dmgStats.length} hits (${maxHit} max) - ${crits} (${critRatePercent}%) crits - 1 targets`);

  return lines.join('\n');
}

// Generate the high-quality preloaded sessions
export const SAMPLE_RUN_SHURIKEN = generateRunLog('shuriken', 30);
export const SAMPLE_RUN_METEOR = generateRunLog('meteor', 32);
export const SAMPLE_RUN_FIRE = generateRunLog('fire', 30);

export const SAMPLE_SESSIONS: Array<{ name: string, rawText: string }> = [];
