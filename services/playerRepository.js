import {
  doc,
  getDoc,
  setDoc,
  increment,
  arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../firebase-init.js';
import { Player } from '../classes/Player.js';
import { PlayerStatistics } from '../classes/PlayerStatistics.js';
import { HistoryEntryType, buildEditLink } from '../classes/HistoryEntryType.js';
import { Rank } from '../classes/Rank.js';
import { getLevelingConfig, computeLevelForXp, computeRankForLevel } from './levelingConfig.js';
import { getEventsConfig, computeEarningsMultiplier } from './eventsConfig.js';

const PLAYER_DOC = doc(db, 'players', 'main');
const STATISTICS_DOC = doc(db, 'playerStatistics', 'main');

/**
 * Applies gold/energy (plain increments) and xp (read-modify-write, since a
 * new level/rank has to be derived from the resulting total) to the player
 * doc, after scaling the raw amounts by the current day-bonus/double-earnings
 * multipliers. Only touches `level`/`rank` when leveling thresholds are
 * configured. Returns the actually-applied (post-multiplier) amounts, plus
 * `leveledUpTo`/`rankedUpTo` (the new level/rank, or null if unchanged) so
 * callers can log accurate statistics/history and show level/rank-up popups.
 */
async function applyRewards({ xp = 0, gold = 0, energy = 0 }) {
  const eventsConfig = await getEventsConfig();
  const multiplier = computeEarningsMultiplier(eventsConfig);
  const finalXp = xp * multiplier.xp;
  const finalGold = Math.round(gold * multiplier.gold);
  const finalEnergy = Math.round(energy * multiplier.energy);

  const updates = {
    gold: increment(finalGold),
    energy: increment(finalEnergy),
  };

  let leveledUpTo = null;
  let rankedUpTo = null;

  if (finalXp !== 0) {
    const [snap, levelingConfig] = await Promise.all([getDoc(PLAYER_DOC), getLevelingConfig()]);
    const data = snap.exists() ? snap.data() : {};
    const currentXp = data.xp ?? 0;
    const currentLevel = data.level ?? 1;
    const currentRank = data.rank ?? Rank.BEGINNER;
    const newXp = currentXp + finalXp;
    updates.xp = newXp;

    if (levelingConfig.xpThresholds.length > 0) {
      const newLevel = computeLevelForXp(newXp, levelingConfig.xpThresholds);
      updates.level = newLevel;
      if (newLevel > currentLevel) {
        leveledUpTo = newLevel;
      }

      if (levelingConfig.rankThresholds.length > 0) {
        const newRank = computeRankForLevel(newLevel, levelingConfig.rankThresholds);
        updates.rank = newRank;
        if (newRank !== currentRank) {
          rankedUpTo = newRank;
        }
      }
    }
  }

  await setDoc(PLAYER_DOC, updates, { merge: true });

  return { xp: finalXp, gold: finalGold, energy: finalEnergy, leveledUpTo, rankedUpTo };
}

export async function getPlayer() {
  const snap = await getDoc(PLAYER_DOC);
  const data = snap.exists() ? snap.data() : {};
  return Player.fromJSON(data);
}

/**
 * Kept on its own document, separate from the player doc, since `history`
 * grows unbounded and would otherwise be re-fetched on every player read.
 */
export async function getPlayerStatistics() {
  const snap = await getDoc(STATISTICS_DOC);
  const data = snap.exists() ? snap.data() : {};
  return PlayerStatistics.fromJSON(data);
}

export async function savePlayerName(name) {
  await setDoc(PLAYER_DOC, { name }, { merge: true });
}

/**
 * Resets the player and player-statistics docs back to their class defaults.
 * Leaves monsters/quests/dungeons (and their per-dungeon progress) untouched.
 */
export async function resetPlayer() {
  await Promise.all([
    setDoc(PLAYER_DOC, new Player().toJSON()),
    setDoc(STATISTICS_DOC, new PlayerStatistics().toJSON()),
  ]);
}

/**
 * Which dungeon the game page is currently showing. Per-dungeon progress
 * (which monsters/quests are done) lives on the dungeon doc itself, not
 * here, so it survives the dungeon being picked again later.
 */
export async function getCurrentDungeonId() {
  const snap = await getDoc(PLAYER_DOC);
  const data = snap.exists() ? snap.data() : {};
  return data.game?.dungeonId ?? null;
}

export async function setCurrentDungeonId(dungeonId) {
  await setDoc(PLAYER_DOC, { 'game.dungeonId': dungeonId }, { merge: true });
}

/**
 * Subtracts a positive amount from the player's gold/energy. The result can
 * go negative (e.g. an energy debt) — no clamping is applied.
 */
export async function spendGold(amount) {
  await setDoc(PLAYER_DOC, { gold: increment(-Math.abs(amount)) }, { merge: true });
}

export async function spendEnergy(amount) {
  await setDoc(PLAYER_DOC, { energy: increment(-Math.abs(amount)) }, { merge: true });
}

/**
 * Applies the rewards for slaying a monster (gold/xp/energy) to the player
 * doc, and bumps the relevant PlayerStatistics counters + history entry on
 * the separate statistics doc.
 * @param {{id: string, name: string, is_elite?: boolean, xp_to_give_when_defeated?: number, gold_to_give_when_defeated?: number, energy_to_give_when_defeated?: number}} monster
 */
export async function recordMonsterSlain(monster) {
  const rewardXp = monster.xp_to_give_when_defeated ?? 0;
  const rewardGold = monster.gold_to_give_when_defeated ?? 0;
  const rewardEnergy = monster.energy_to_give_when_defeated ?? 0;

  const applied = await applyRewards({ xp: rewardXp, gold: rewardGold, energy: rewardEnergy });

  const entry = {
    type: HistoryEntryType.MONSTER,
    id: monster.id,
    name: monster.name,
    link: buildEditLink(HistoryEntryType.MONSTER, monster.id),
    defeatedAt: new Date().toISOString(),
  };

  const statsUpdates = {
    total_xp_gained: increment(applied.xp),
    monster_defeated: increment(1),
    history: arrayUnion(entry),
  };
  if (monster.is_elite) {
    statsUpdates.elite_defeated = increment(1);
  }

  await setDoc(STATISTICS_DOC, statsUpdates, { merge: true });
  return applied;
}

/**
 * Applies the rewards for completing a quest (gold/xp/energy) to the player
 * doc, and bumps the `objective_claimed` counter + history entry on the
 * separate statistics doc.
 * @param {{id: string, title: string, xp_to_give_when_defeated?: number, gold_to_give_when_defeated?: number, energy_to_give_when_defeated?: number}} quest
 */
export async function recordQuestCompleted(quest) {
  const rewardXp = quest.xp_to_give_when_defeated ?? 0;
  const rewardGold = quest.gold_to_give_when_defeated ?? 0;
  const rewardEnergy = quest.energy_to_give_when_defeated ?? 0;

  const applied = await applyRewards({ xp: rewardXp, gold: rewardGold, energy: rewardEnergy });

  const entry = {
    type: HistoryEntryType.QUEST,
    id: quest.id,
    name: quest.title,
    link: buildEditLink(HistoryEntryType.QUEST, quest.id),
    defeatedAt: new Date().toISOString(),
  };

  await setDoc(
    STATISTICS_DOC,
    {
      total_xp_gained: increment(applied.xp),
      objective_claimed: increment(1),
      history: arrayUnion(entry),
    },
    { merge: true }
  );
  return applied;
}

/**
 * Applies the configured Fast Fight reward (gold/xp/energy) to the player
 * doc, and logs a history entry linking back to the Events page where its
 * reward amounts can be reconfigured.
 * @param {{xp?: number, gold?: number, energy?: number}} fastFightConfig
 */
export async function recordFastFight(fastFightConfig) {
  const rewardXp = fastFightConfig.xp ?? 0;
  const rewardGold = fastFightConfig.gold ?? 0;
  const rewardEnergy = fastFightConfig.energy ?? 0;

  const applied = await applyRewards({ xp: rewardXp, gold: rewardGold, energy: rewardEnergy });

  const entry = {
    type: HistoryEntryType.FAST_FIGHT,
    id: 'fastFight',
    name: 'Fast Fight',
    link: buildEditLink(HistoryEntryType.FAST_FIGHT, 'fastFight'),
    defeatedAt: new Date().toISOString(),
  };

  await setDoc(
    STATISTICS_DOC,
    {
      total_xp_gained: increment(applied.xp),
      history: arrayUnion(entry),
    },
    { merge: true }
  );
  return applied;
}
