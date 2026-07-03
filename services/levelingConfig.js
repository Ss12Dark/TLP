import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../firebase-init.js';
import { Rank, isValidRank } from '../classes/Rank.js';

const LEVELING_DOC = doc(db, 'gameConfig', 'leveling');

/**
 * @returns {Promise<{xpThresholds: number[], rankThresholds: Array<{level: number, rank: string}>}>}
 */
export async function getLevelingConfig() {
  const snap = await getDoc(LEVELING_DOC);
  const data = snap.exists() ? snap.data() : {};
  return {
    xpThresholds: Array.isArray(data.xpThresholds) ? data.xpThresholds : [],
    rankThresholds: Array.isArray(data.rankThresholds) ? data.rankThresholds : [],
  };
}

export async function saveLevelingConfig({ xpThresholds, rankThresholds }) {
  await setDoc(LEVELING_DOC, { xpThresholds, rankThresholds }, { merge: true });
}

/**
 * xpThresholds[i] is the total XP needed to advance from level (i + 1) to
 * level (i + 2) — levels start at 1, matching the Player class default.
 */
export function computeLevelForXp(xp, xpThresholds) {
  let level = 1;
  let index = 0;
  while (xpThresholds[index] !== undefined && xp >= xpThresholds[index]) {
    level += 1;
    index += 1;
  }
  return level;
}

/**
 * Picks the rank of the highest-level threshold the given level has reached.
 */
export function computeRankForLevel(level, rankThresholds) {
  let rank = Rank.BEGINNER;
  const sorted = [...rankThresholds].sort((a, b) => a.level - b.level);
  for (const entry of sorted) {
    if (level < entry.level) break;
    if (isValidRank(entry.rank)) {
      rank = entry.rank;
    }
  }
  return rank;
}
