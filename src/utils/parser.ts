import { RawLogLine, SessionData, MoveStats, TimePoint, ParsedAction } from '../types';

/**
 * Parsers a raw string of combat logs into detailed structures.
 */
export function parseLogFile(rawText: string, fileName: string): SessionData {
  const lines = rawText.split('\n');
  const parsedLines: RawLogLine[] = [];
  
  // 1. First Pass: Parse every line to identify potential events
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const jsonStart = line.indexOf('{');
    const jsonEnd = line.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const timestampStr = line.substring(0, jsonStart).trim();
      const timestamp = parseInt(timestampStr, 10);
      let jsonStr = line.substring(jsonStart, jsonEnd + 1);
      
      try {
        jsonStr = jsonStr.replace(/"(iei|tei)":\s*(\d+)/g, '"$1": "$2"');
        const data = JSON.parse(jsonStr);
        const afterJson = line.substring(jsonEnd + 1).trim();
        const bracketMatch = afterJson.match(/^\[(.*?)\]\s*(.*)$/);
        const eventType = bracketMatch ? bracketMatch[1] : '';
        const logText = bracketMatch ? bracketMatch[2] : afterJson;
        
        parsedLines.push({
          timestamp,
          eventType,
          logText,
          data
        });
      } catch (e) {
        // Skip malformed JSON lines gracefully
      }
    } else if (line.includes('[Summary]')) {
      const summaryIdx = line.indexOf('[Summary]');
      const timestampStr = line.substring(0, summaryIdx).trim();
      const timestamp = parseInt(timestampStr, 10);
      const logText = line.substring(summaryIdx + 9).trim();
      parsedLines.push({
        timestamp,
        eventType: 'Summary',
        logText,
        data: {}
      });
    }
  }

  // 2. Identify the primary Initiator (the actor doing damage)
  // We count the number of "Damage Out" events for each initiator name (inm)
  const initiatorCounts: Record<string, number> = {};
  parsedLines.forEach(line => {
    if (line.eventType === 'Damage Out' && line.data.inm) {
      initiatorCounts[line.data.inm] = (initiatorCounts[line.data.inm] || 0) + 1;
    }
  });
  
  let primaryInitiator = '';
  let maxEvents = 0;
  Object.entries(initiatorCounts).forEach(([name, count]) => {
    if (count > maxEvents) {
      maxEvents = count;
      primaryInitiator = name;
    }
  });

  // Fallback if no specific initiator was found doing damage
  if (!primaryInitiator && parsedLines.length > 0) {
    const firstWithInm = parsedLines.find(line => line.data.inm);
    primaryInitiator = firstWithInm?.data.inm || 'Unknown Actor';
  }

  // 2.5 Populate allActions of all 8 types
  const allActions: ParsedAction[] = [];
  parsedLines.forEach(line => {
    const val = line.data.vfi || 0;
    if (val <= 0) return; // skip events with no value (CC/CC break, etc.)

    const evType = line.eventType;
    const isOut = ['Damage Out', 'Healing Out', 'Power Out', 'Supercharge Out'].includes(evType);
    const isIn = ['Damage In', 'Healing In', 'Power In', 'Supercharge In'].includes(evType);

    if ((isOut && line.data.inm === primaryInitiator) || (isIn && line.data.tnm === primaryInitiator)) {
      let actor = line.data.inm || (isOut ? primaryInitiator : 'Unknown Source');
      let moveName = line.data.anm || 'Unknown Skill';

      const cleanText = line.logText.trim();
      const verbIndex = cleanText.search(/\s+(?:critically\s+)?(?:damaged|healed|absorbed)\s+/i);
      
      if (verbIndex !== -1) {
        const actionPart = cleanText.substring(0, verbIndex);
        const apoIndex = actionPart.indexOf("'s");
        if (apoIndex !== -1) {
          actor = actionPart.substring(0, apoIndex).trim();
          moveName = actionPart.substring(apoIndex + 2).trim();
        } else {
          moveName = actionPart.trim();
          actor = isOut ? primaryInitiator : (line.data.inm || 'Unknown Source');
        }
      }

      if (line.data.tnm && actor === line.data.tnm) {
        actor = isOut ? primaryInitiator : (line.data.inm || 'Unknown Source');
      }

      const lowerText = cleanText.toLowerCase();
      if ((evType === 'Healing Out' || evType === 'Healing In') && lowerText.includes('absorbed')) {
        moveName = `${moveName} (Shield)`;
      }

      const isCrit = line.logText.toLowerCase().includes('critically');
      const target = line.data.tnm || 'Unknown Target';
      const targetId = line.data.tei ? String(line.data.tei) : undefined;

      allActions.push({
        timestamp: line.timestamp,
        eventType: evType,
        actor,
        moveName,
        value: val,
        isCrit,
        target,
        targetId
      });
    }
  });

  // 3. Process combat elements of the primary initiator
  // Filter events related to the primary initiator
  const initiatorEvents = parsedLines.filter(line => 
    line.data.inm === primaryInitiator || line.data.tei === primaryInitiator
  );

  let firstTimestamp = parsedLines.length > 0 ? parsedLines[0].timestamp : 0;
  let lastTimestamp = parsedLines.length > 0 ? parsedLines[parsedLines.length - 1].timestamp : 0;

  // Refine timestamps purely based on the player's active damage contributions 
  // (filtering out passive Damage In lines where player is the object, and late healing sweeps)
  const activeCombatTimestamps = parsedLines
    .filter(l => l.eventType === 'Damage Out' && l.data.inm === primaryInitiator)
    .map(l => l.timestamp);
    
  if (activeCombatTimestamps.length > 0) {
    firstTimestamp = Math.min(...activeCombatTimestamps);
    lastTimestamp = Math.max(...activeCombatTimestamps);
  }

  const durationMicroseconds = lastTimestamp - firstTimestamp;
  const durationInSeconds = Math.max(1, Math.ceil(durationMicroseconds / 1000000));

  // Gather moves (abilities) stats
  const movesMap: Record<string, {
    name: string;
    actor: string;
    totalDamage: number;
    hits: number[];
    critCount: number;
  }> = {};

  let totalDamage = 0;
  let totalHealing = 0;
  let totalPower = 0;
  const targetIdMap: Record<string, Set<string>> = {};

  parsedLines.forEach(line => {
    // Only capture events originating under the primary initiator
    if (line.data.inm === primaryInitiator) {
      const val = line.data.vfi || 0;

      if (line.eventType === 'Damage Out') {
        let actor = primaryInitiator;
        let moveName = line.data.anm || 'Unknown Skill';

        // Parse from human-readable text for highest accuracy on pet/summon source
        const cleanText = line.logText.trim();
        const damagedIndex = cleanText.search(/\s+(?:critically\s+)?damaged\s+/i);
        if (damagedIndex !== -1) {
          const actionPart = cleanText.substring(0, damagedIndex);
          const apoIndex = actionPart.indexOf("'s");
          if (apoIndex !== -1) {
            actor = actionPart.substring(0, apoIndex).trim();
            moveName = actionPart.substring(apoIndex + 2).trim();
          } else {
            // No "'s", it's the player's direct action
            moveName = actionPart.trim();
            actor = primaryInitiator;
          }
        }

        // If the parsed actor name matches the target name, it is a player's DoT/proc applied to the target.
        // It must be attributed back to the primary initiator player.
        if (line.data.tnm && actor === line.data.tnm) {
          actor = primaryInitiator;
        }

        totalDamage += val;
        if (line.data.tnm) {
          const tnm = line.data.tnm;
          const tei = line.data.tei ? String(line.data.tei) : 'unknown';
          if (!targetIdMap[tnm]) {
            targetIdMap[tnm] = new Set<string>();
          }
          targetIdMap[tnm].add(tei);
        }

        const key = `${actor}:${moveName}`;
        if (!movesMap[key]) {
          movesMap[key] = { name: moveName, actor: actor, totalDamage: 0, hits: [], critCount: 0 };
        }
        
        movesMap[key].totalDamage += val;
        movesMap[key].hits.push(val);
        
        // Check if critical damage
        const isCrit = line.logText.toLowerCase().includes('critically');
        if (isCrit) {
          movesMap[key].critCount += 1;
        }
      } else if (line.eventType === 'Healing Out' || line.eventType === 'Healing In') {
        totalHealing += val;
      } else if (line.eventType === 'Power Out' || line.eventType === 'Power In') {
        totalPower += val;
      }
    }
  });

  // Build MoveStats Array
  const movesStats: MoveStats[] = Object.entries(movesMap).map(([key, data]) => {
    const hits = data.hits;
    const hitCount = hits.length;
    const minHit = hitCount > 0 ? Math.min(...hits) : 0;
    const maxHit = hitCount > 0 ? Math.max(...hits) : 0;
    const totalHitDmg = data.totalDamage;
    const avgHit = hitCount > 0 ? Math.round(totalHitDmg / hitCount) : 0;
    const percentage = totalDamage > 0 ? Number(((totalHitDmg / totalDamage) * 100).toFixed(1)) : 0;
    const critRate = hitCount > 0 ? Number(((data.critCount / hitCount) * 100).toFixed(1)) : 0;
    const dps = Number((totalHitDmg / durationInSeconds).toFixed(1));

    return {
      name: data.name,
      totalDamage: totalHitDmg,
      percentage,
      hitCount,
      critCount: data.critCount,
      critRate,
      minHit,
      maxHit,
      avgHit,
      dps,
      actor: data.actor
    };
  }).sort((a, b) => b.totalDamage - a.totalDamage);

  // 4. Build Timeline (by 1-second buckets)
  const timeline: TimePoint[] = [];
  let runningDamageSum = 0;

  for (let i = 0; i <= durationInSeconds; i++) {
    const secondStart = firstTimestamp + i * 1000000;
    const secondEnd = firstTimestamp + (i + 1) * 1000000;

    // Filter events landing in this second
    const intervalEvents = parsedLines.filter(line => 
      line.timestamp >= secondStart && line.timestamp < secondEnd
    );

    let damageSumThisSec = 0;
    let healingSumThisSec = 0;
    const movesThisSec: Record<string, number> = {};
    const actionsThisSec: any[] = [];

    intervalEvents.forEach(line => {
      if (line.data.inm === primaryInitiator) {
        const val = line.data.vfi || 0;

        if (line.eventType === 'Damage Out') {
          let actor = primaryInitiator;
          let moveName = line.data.anm || 'Unknown Skill';

          // Same parser logic for the timeline moves mapping
          const cleanText = line.logText.trim();
          const damagedIndex = cleanText.search(/\s+(?:critically\s+)?damaged\s+/i);
          if (damagedIndex !== -1) {
            const actionPart = cleanText.substring(0, damagedIndex);
            const apoIndex = actionPart.indexOf("'s");
            if (apoIndex !== -1) {
              actor = actionPart.substring(0, apoIndex).trim();
              moveName = actionPart.substring(apoIndex + 2).trim();
            } else {
              moveName = actionPart.trim();
              actor = primaryInitiator;
            }
          }

          // If the parsed actor name matches the target name, attribute back to primary initiator player
          if (line.data.tnm && actor === line.data.tnm) {
            actor = primaryInitiator;
          }

          damageSumThisSec += val;
          const key = `${actor}:${moveName}`;
          movesThisSec[key] = (movesThisSec[key] || 0) + val;

          const isCrit = line.logText.toLowerCase().includes('critically');
          const targetId = line.data.tei ? String(line.data.tei) : undefined;
          actionsThisSec.push({
            timestamp: line.timestamp,
            actor,
            moveName,
            damage: val,
            isCrit,
            target: line.data.tnm || 'Sparring Target',
            targetId
          });
        } else if (line.eventType === 'Healing Out' || line.eventType === 'Healing In') {
          healingSumThisSec += val;
        }
      }
    });

    // Sort actions within this second chronologically
    actionsThisSec.sort((a, b) => a.timestamp - b.timestamp);

    runningDamageSum += damageSumThisSec;

    timeline.push({
      timeInSeconds: i,
      rawTimestamp: secondStart,
      damageSum: damageSumThisSec,
      healingSum: healingSumThisSec,
      cumulativeDamage: runningDamageSum,
      moves: movesThisSec,
      actions: actionsThisSec
    });
  }

  const overallDps = Number((totalDamage / durationInSeconds).toFixed(1));
  const overallHps = Number((totalHealing / durationInSeconds).toFixed(1));
  
  const totalHitsCount = parsedLines.filter(line => 
    line.eventType === 'Damage Out' && line.data.inm === primaryInitiator
  ).length;

  const totalCritsCount = parsedLines.filter(line => 
    line.eventType === 'Damage Out' && line.data.inm === primaryInitiator && line.logText.toLowerCase().includes('critically')
  ).length;

  const critRate = totalHitsCount > 0 ? Number(((totalCritsCount / totalHitsCount) * 100).toFixed(1)) : 0;

  let activeTargetCount = 0;
  const targetsList: string[] = [];
  Object.entries(targetIdMap).forEach(([tnm, teiSet]) => {
    activeTargetCount += teiSet.size;
    if (teiSet.size > 1) {
      targetsList.push(`${tnm} (x${teiSet.size})`);
    } else {
      targetsList.push(tnm);
    }
  });

  return {
    id: fileName + '_' + Date.now().toString(),
    fileName,
    durationInSeconds,
    totalDamage,
    totalHealing,
    totalPower,
    overallDps,
    overallHps,
    critRate,
    hitCount: totalHitsCount,
    activeTargetCount,
    targets: targetsList,
    initiatorName: primaryInitiator,
    moves: movesStats,
    timeline,
    rawLinesCount: lines.length,
    rawLogs: lines,
    allActions
  };
}

/**
 * Recomputes full combat SessionData based on a sliced list of timepoints.
 * This is used to seamlessly split parsed runs at a custom timestamp.
 */
export function recomputeSessionFromTimeline(
  originalSession: SessionData,
  subTimeline: TimePoint[],
  newName: string,
  suffixId: string
): SessionData {
  const duration = Math.max(1, subTimeline.length - 1);
  
  let totalDamage = 0;
  let totalHealing = 0;
  const targetIdMap: Record<string, Set<string>> = {};
  
  const movesMap: Record<string, {
    name: string;
    actor: string;
    totalDamage: number;
    hits: number[];
    critCount: number;
  }> = {};

  subTimeline.forEach(pt => {
    totalHealing += pt.healingSum;
    const actions = pt.actions || [];
    actions.forEach(act => {
      totalDamage += act.damage;
      if (act.target) {
        const tnm = act.target;
        const tei = act.targetId || 'unknown';
        if (!targetIdMap[tnm]) {
          targetIdMap[tnm] = new Set<string>();
        }
        targetIdMap[tnm].add(tei);
      }
      
      const key = `${act.actor}:${act.moveName}`;
      if (!movesMap[key]) {
        movesMap[key] = {
          name: act.moveName,
          actor: act.actor,
          totalDamage: 0,
          hits: [],
          critCount: 0
        };
      }
      movesMap[key].totalDamage += act.damage;
      movesMap[key].hits.push(act.damage);
      if (act.isCrit) {
        movesMap[key].critCount += 1;
      }
    });
  });

  const movesStats: MoveStats[] = Object.entries(movesMap).map(([key, data]) => {
    const hits = data.hits;
    const hitCount = hits.length;
    const minHit = hitCount > 0 ? Math.min(...hits) : 0;
    const maxHit = hitCount > 0 ? Math.max(...hits) : 0;
    const totalHitDmg = data.totalDamage;
    const avgHit = hitCount > 0 ? Math.round(totalHitDmg / hitCount) : 0;
    const percentage = totalDamage > 0 ? Number(((totalHitDmg / totalDamage) * 100).toFixed(1)) : 0;
    const critRate = hitCount > 0 ? Number(((data.critCount / hitCount) * 100).toFixed(1)) : 0;
    const dps = Number((totalHitDmg / duration).toFixed(1));

    return {
      name: data.name,
      totalDamage: totalHitDmg,
      percentage,
      hitCount,
      critCount: data.critCount,
      critRate,
      minHit,
      maxHit,
      avgHit,
      dps,
      actor: data.actor
    };
  }).sort((a, b) => b.totalDamage - a.totalDamage);

  const overallDps = Number((totalDamage / duration).toFixed(1));
  const overallHps = Number((totalHealing / duration).toFixed(1));
  
  let totalHitsCount = 0;
  let totalCritsCount = 0;
  subTimeline.forEach(pt => {
    const actions = pt.actions || [];
    actions.forEach(act => {
      totalHitsCount++;
      if (act.isCrit) totalCritsCount++;
    });
  });
  const critRate = totalHitsCount > 0 ? Number(((totalCritsCount / totalHitsCount) * 100).toFixed(1)) : 0;

  // Shift cumulative damage in subTimeline to start from 0 at the beginning of this segment!
  let runningCumulative = 0;
  const adjustedTimeline = subTimeline.map((pt, idx) => {
    runningCumulative += pt.damageSum;
    return {
      ...pt,
      timeInSeconds: idx,
      cumulativeDamage: runningCumulative
    };
  });

  const minTs = subTimeline[0]?.rawTimestamp || 0;
  const maxTs = subTimeline[subTimeline.length - 1]?.rawTimestamp || Number.MAX_SAFE_INTEGER;
  const rawLogs = originalSession.rawLogs ? originalSession.rawLogs.filter(line => {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) return false;
    const ts = parseInt(line.substring(0, spaceIdx), 10);
    return ts >= minTs && ts <= maxTs;
  }) : undefined;

  const slicedActions = originalSession.allActions
    ? originalSession.allActions.filter(act => act.timestamp >= minTs && act.timestamp <= maxTs)
    : undefined;

  let activeTargetCount = 0;
  const targetsList: string[] = [];
  Object.entries(targetIdMap).forEach(([tnm, teiSet]) => {
    activeTargetCount += teiSet.size;
    if (teiSet.size > 1) {
      targetsList.push(`${tnm} (x${teiSet.size})`);
    } else {
      targetsList.push(tnm);
    }
  });

  return {
    id: `${originalSession.id}_${suffixId}_${Date.now()}`,
    fileName: newName,
    durationInSeconds: duration,
    totalDamage,
    totalHealing,
    totalPower: Math.round(originalSession.totalPower * (duration / originalSession.durationInSeconds)),
    overallDps,
    overallHps,
    critRate,
    hitCount: totalHitsCount,
    activeTargetCount,
    targets: targetsList,
    initiatorName: originalSession.initiatorName,
    moves: movesStats,
    timeline: adjustedTimeline,
    rawLinesCount: rawLogs ? rawLogs.length : originalSession.rawLinesCount,
    rawLogs,
    allActions: slicedActions
  };
}

/**
 * Computes metric-specific combat SessionData on demand.
 */
export function getMetricSessionData(
  session: SessionData,
  activeMetric: string,
  selectedActorFilter: string = 'all',
  selectedTargetFilter: string = 'all'
): SessionData {
  const actions = session.allActions || [];
  
  // 1. Filter by activeMetric (eventType)
  let metricActions = [];
  if (activeMetric === 'Damage In (Shielded)') {
    metricActions = actions.filter(act => {
      if (act.eventType === 'Damage In') {
        return true;
      }
      if (act.eventType === 'Healing In' || act.eventType === 'Healing Out') {
        return act.moveName.endsWith(' (Shield)');
      }
      return false;
    });
  } else {
    metricActions = actions.filter(act => act.eventType === activeMetric);
  }
  
  // 2. Filter by actor if selectedActorFilter is not 'all'
  if (selectedActorFilter !== 'all') {
    metricActions = metricActions.filter(act => act.actor === selectedActorFilter);
  }

  // 2b. Filter by target if selectedTargetFilter is not 'all'
  if (selectedTargetFilter !== 'all') {
    metricActions = metricActions.filter(act => act.target === selectedTargetFilter);
  }

  // 3. Compute duration & boundaries
  const duration = session.durationInSeconds || 1;

  // 4. Compute overall sums
  let totalValue = 0;
  let critCount = 0;
  const targetIdMap: Record<string, Set<string>> = {};
  
  const movesMap: Record<string, {
    name: string;
    actor: string;
    totalValue: number;
    hits: number[];
    critCount: number;
  }> = {};

  metricActions.forEach(act => {
    totalValue += act.value;
    if (act.isCrit) critCount++;
    
    if (act.target) {
      const tnm = act.target;
      const tei = act.targetId || 'unknown';
      if (!targetIdMap[tnm]) {
        targetIdMap[tnm] = new Set<string>();
      }
      targetIdMap[tnm].add(tei);
    }

    const key = `${act.actor}:${act.moveName}`;
    if (!movesMap[key]) {
      movesMap[key] = {
        name: act.moveName,
        actor: act.actor,
        totalValue: 0,
        hits: [],
        critCount: 0
      };
    }
    movesMap[key].totalValue += act.value;
    movesMap[key].hits.push(act.value);
    if (act.isCrit) {
      movesMap[key].critCount++;
    }
  });

  // Build MoveStats Array
  const movesStats: MoveStats[] = Object.entries(movesMap).map(([key, data]) => {
    const hits = data.hits;
    const hitCount = hits.length;
    const minHit = hitCount > 0 ? Math.min(...hits) : 0;
    const maxHit = hitCount > 0 ? Math.max(...hits) : 0;
    const totalHitVal = data.totalValue;
    const avgHit = hitCount > 0 ? Math.round(totalHitVal / hitCount) : 0;
    const percentage = totalValue > 0 ? Number(((totalHitVal / totalValue) * 100).toFixed(1)) : 0;
    const critRate = hitCount > 0 ? Number(((data.critCount / hitCount) * 100).toFixed(1)) : 0;
    const dps = Number((totalHitVal / duration).toFixed(1));

    return {
      name: data.name,
      totalDamage: totalHitVal,
      percentage,
      hitCount,
      critCount: data.critCount,
      critRate,
      minHit,
      maxHit,
      avgHit,
      dps,
      actor: data.actor
    };
  }).sort((a, b) => b.totalDamage - a.totalDamage);

  const overallRate = Number((totalValue / duration).toFixed(1));
  const critRate = metricActions.length > 0 ? Number(((critCount / metricActions.length) * 100).toFixed(1)) : 0;

  // 5. Build Metric Specific Timeline
  const firstTimestamp = session.timeline[0]?.rawTimestamp || 0;
  const timeline: TimePoint[] = [];
  let runningCumulative = 0;

  for (let i = 0; i <= duration; i++) {
    const secondStart = firstTimestamp + i * 1000000;
    const secondEnd = firstTimestamp + (i + 1) * 1000000;

    const intervalActions = metricActions.filter(act => 
      act.timestamp >= secondStart && act.timestamp < secondEnd
    );

    let valueSumThisSec = 0;
    const movesThisSec: Record<string, number> = {};
    const actionsThisSec: any[] = [];

    intervalActions.forEach(act => {
      valueSumThisSec += act.value;
      const key = `${act.actor}:${act.moveName}`;
      movesThisSec[key] = (movesThisSec[key] || 0) + act.value;

      actionsThisSec.push({
        timestamp: act.timestamp,
        actor: act.actor,
        moveName: act.moveName,
        damage: act.value,
        isCrit: act.isCrit,
        target: act.target,
        targetId: act.targetId
      });
    });

    actionsThisSec.sort((a, b) => a.timestamp - b.timestamp);
    runningCumulative += valueSumThisSec;

    timeline.push({
      timeInSeconds: i,
      rawTimestamp: secondStart,
      damageSum: valueSumThisSec,
      healingSum: valueSumThisSec,
      cumulativeDamage: runningCumulative,
      moves: movesThisSec,
      actions: actionsThisSec
    });
  }

  let activeTargetCount = 0;
  const targetsList: string[] = [];
  Object.entries(targetIdMap).forEach(([tnm, teiSet]) => {
    activeTargetCount += teiSet.size;
    if (teiSet.size > 1) {
      targetsList.push(`${tnm} (x${teiSet.size})`);
    } else {
      targetsList.push(tnm);
    }
  });

  return {
    ...session,
    durationInSeconds: duration,
    totalDamage: totalValue,
    overallDps: overallRate,
    critRate,
    hitCount: metricActions.length,
    activeTargetCount,
    targets: targetsList,
    moves: movesStats,
    timeline
  };
}

