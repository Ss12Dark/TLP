import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  where,
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

const PLAYERS_COLLECTION = 'players';
const STATISTICS_COLLECTION = 'playerStatistics';

function playerDoc(playerId) {
  return doc(db, PLAYERS_COLLECTION, playerId);
}

function statisticsDoc(playerId) {
  return doc(db, STATISTICS_COLLECTION, playerId);
}

/**
 * Looks up a player profile by its (case-sensitive) name.
 * @returns {Promise<{id: string, name: string, ...} | null>}
 */
export async function findPlayerByName(name) {
  const snapshot = await getDocs(query(collection(db, PLAYERS_COLLECTION), where('name', '==', name)));
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

export async function isNameTaken(name, excludePlayerId = null) {
  const existing = await findPlayerByName(name);
  return Boolean(existing) && existing.id !== excludePlayerId;
}

/**
 * Creates a new player profile (with a fresh statistics doc) and returns its id.
 */
export async function createPlayer(name) {
  const ref = await addDoc(collection(db, PLAYERS_COLLECTION), new Player({ name }).toJSON());
  await setDoc(doc(db, STATISTICS_COLLECTION, ref.id), new PlayerStatistics().toJSON());
  return ref.id;
}

/**
 * Applies gold/energy (plain increments) and xp (read-modify-write, since a
 * new level/rank has to be derived from the resulting total) to the player
 * doc, after scaling the raw amounts by the current day-bonus/double-earnings
 * multipliers. Only touches `level`/`rank` when leveling thresholds are
 * configured. Returns the actually-applied (post-multiplier) amounts, plus
 * `leveledUpTo`/`rankedUpTo` (the new level/rank, or null if unchanged) so
 * callers can log accurate statistics/history and show level/rank-up popups.
 */
async function applyRewards(playerId, { xp = 0, gold = 0, energy = 0 }) {
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
    const pDoc = playerDoc(playerId);
    const [snap, levelingConfig] = await Promise.all([getDoc(pDoc), getLevelingConfig()]);
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

  await setDoc(playerDoc(playerId), updates, { merge: true });

  return { xp: finalXp, gold: finalGold, energy: finalEnergy, leveledUpTo, rankedUpTo };
}

export async function getPlayer(playerId) {
  const snap = await getDoc(playerDoc(playerId));
  const data = snap.exists() ? snap.data() : {};
  return Player.fromJSON(data);
}

/**
 * Kept on its own document, separate from the player doc, since `history`
 * grows unbounded and would otherwise be re-fetched on every player read.
 */
export async function getPlayerStatistics(playerId) {
  const snap = await getDoc(statisticsDoc(playerId));
  const data = snap.exists() ? snap.data() : {};
  return PlayerStatistics.fromJSON(data);
}

/**
 * Renames a player profile. Throws if another player already uses that name,
 * since the name doubles as the "login" — it must stay unique, even though
 * it isn't the underlying document id.
 */
export async function savePlayerName(playerId, name) {
  if (await isNameTaken(name, playerId)) {
    throw new Error('That name is already taken by another player.');
  }
  await setDoc(playerDoc(playerId), { name }, { merge: true });
}

/**
 * Resets the player and player-statistics docs back to their class defaults.
 * Leaves monsters/quests/dungeons (and other players' data) untouched.
 */
export async function resetPlayer(playerId) {
  await Promise.all([
    setDoc(playerDoc(playerId), new Player().toJSON()),
    setDoc(statisticsDoc(playerId), new PlayerStatistics().toJSON()),
  ]);
}

/**
 * Which dungeon the game page is currently showing for this player. Per-player
 * per-dungeon progress (which monsters/quests are done) lives in
 * services/dungeonProgress.js, not here.
 */
export async function getCurrentDungeonId(playerId) {
  const snap = await getDoc(playerDoc(playerId));
  const data = snap.exists() ? snap.data() : {};
  return data.game?.dungeonId ?? null;
}

export async function setCurrentDungeonId(playerId, dungeonId) {
  await setDoc(playerDoc(playerId), { 'game.dungeonId': dungeonId }, { merge: true });
}

/**
 * Subtracts a positive amount from the player's gold/energy. The result can
 * go negative (e.g. an energy debt) — no clamping is applied.
 */
export async function spendGold(playerId, amount) {
  await setDoc(playerDoc(playerId), { gold: increment(-Math.abs(amount)) }, { merge: true });
}

export async function spendEnergy(playerId, amount) {
  await setDoc(playerDoc(playerId), { energy: increment(-Math.abs(amount)) }, { merge: true });
}

/**
 * Applies the rewards for slaying a monster (gold/xp/energy) to the player
 * doc, and bumps the relevant PlayerStatistics counters + history entry on
 * the separate statistics doc.
 * @param {{id: string, name: string, is_elite?: boolean, xp_to_give_when_defeated?: number, gold_to_give_when_defeated?: number, energy_to_give_when_defeated?: number}} monster
 */
export async function recordMonsterSlain(playerId, monster) {
  const rewardXp = monster.xp_to_give_when_defeated ?? 0;
  const rewardGold = monster.gold_to_give_when_defeated ?? 0;
  const rewardEnergy = monster.energy_to_give_when_defeated ?? 0;

  const applied = await applyRewards(playerId, { xp: rewardXp, gold: rewardGold, energy: rewardEnergy });

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

  await setDoc(statisticsDoc(playerId), statsUpdates, { merge: true });
  return applied;
}

/**
 * Applies the rewards for completing a quest (gold/xp/energy) to the player
 * doc, and bumps the `objective_claimed` counter + history entry on the
 * separate statistics doc.
 * @param {{id: string, title: string, xp_to_give_when_defeated?: number, gold_to_give_when_defeated?: number, energy_to_give_when_defeated?: number}} quest
 */
export async function recordQuestCompleted(playerId, quest) {
  const rewardXp = quest.xp_to_give_when_defeated ?? 0;
  const rewardGold = quest.gold_to_give_when_defeated ?? 0;
  const rewardEnergy = quest.energy_to_give_when_defeated ?? 0;

  const applied = await applyRewards(playerId, { xp: rewardXp, gold: rewardGold, energy: rewardEnergy });

  const entry = {
    type: HistoryEntryType.QUEST,
    id: quest.id,
    name: quest.title,
    link: buildEditLink(HistoryEntryType.QUEST, quest.id),
    defeatedAt: new Date().toISOString(),
  };

  await setDoc(
    statisticsDoc(playerId),
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
export async function recordFastFight(playerId, fastFightConfig) {
  const rewardXp = fastFightConfig.xp ?? 0;
  const rewardGold = fastFightConfig.gold ?? 0;
  const rewardEnergy = fastFightConfig.energy ?? 0;

  const applied = await applyRewards(playerId, { xp: rewardXp, gold: rewardGold, energy: rewardEnergy });

  const entry = {
    type: HistoryEntryType.FAST_FIGHT,
    id: 'fastFight',
    name: 'Fast Fight',
    link: buildEditLink(HistoryEntryType.FAST_FIGHT, 'fastFight'),
    defeatedAt: new Date().toISOString(),
  };

  await setDoc(
    statisticsDoc(playerId),
    {
      total_xp_gained: increment(applied.xp),
      history: arrayUnion(entry),
    },
    { merge: true }
  );
  return applied;
}
