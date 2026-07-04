import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../firebase-init.js';

const EVENTS_DOC = doc(db, 'gameConfig', 'events');
const FAST_FIGHT_DOC = doc(db, 'gameConfig', 'fastFight');

/**
 * @returns {Promise<{dayBonuses: Array<{day: number, xpPercent: number, goldPercent: number, energyPercent: number}>, doubleEarningsActive: boolean}>}
 */
export async function getEventsConfig() {
  const snap = await getDoc(EVENTS_DOC);
  const data = snap.exists() ? snap.data() : {};
  return {
    dayBonuses: Array.isArray(data.dayBonuses) ? data.dayBonuses : [],
    doubleEarningsActive: Boolean(data.doubleEarningsActive),
  };
}

export async function saveDayBonuses(dayBonuses) {
  await setDoc(EVENTS_DOC, { dayBonuses }, { merge: true });
}

export async function setDoubleEarningsActive(active) {
  await setDoc(EVENTS_DOC, { doubleEarningsActive: active }, { merge: true });
}

/**
 * @returns {Promise<{xp: number, gold: number, energy: number}>}
 */
export async function getFastFightConfig() {
  const snap = await getDoc(FAST_FIGHT_DOC);
  const data = snap.exists() ? snap.data() : {};
  return {
    xp: data.xp ?? 0,
    gold: data.gold ?? 0,
    energy: data.energy ?? 0,
  };
}

export async function saveFastFightConfig({ xp, gold, energy }) {
  await setDoc(FAST_FIGHT_DOC, { xp, gold, energy }, { merge: true });
}

/**
 * Combines the current day's bonus percentages with the manual double-earnings
 * toggle into a single multiplier per reward field. Double earnings only
 * applies to xp/gold, matching the "200% earn on xp and gold" spec.
 */
export function computeEarningsMultiplier(eventsConfig, date = new Date()) {
  const dayEntry = (eventsConfig.dayBonuses ?? []).find((b) => b.day === date.getDay());
  const doubleMultiplier = eventsConfig.doubleEarningsActive ? 2 : 1;
  return {
    xp: (1 + (dayEntry?.xpPercent ?? 0) / 100) * doubleMultiplier,
    gold: (1 + (dayEntry?.goldPercent ?? 0) / 100) * doubleMultiplier,
    energy: 1 + (dayEntry?.energyPercent ?? 0) / 100,
  };
}
