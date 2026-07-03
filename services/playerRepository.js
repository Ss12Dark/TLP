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
import { getLevelingConfig, computeLevelForXp, computeRankForLevel } from './levelingConfig.js';

const PLAYER_DOC = doc(db, 'players', 'main');
const STATISTICS_DOC = doc(db, 'playerStatistics', 'main');

/**
 * Applies gold/energy (plain increments) and xp (read-modify-write, since a
 * new level/rank has to be derived from the resulting total) to the player
 * doc. Only touches `level`/`rank` when the corresponding thresholds are
 * configured, so an unconfigured leveling system is a no-op on those fields.
 */
async function applyRewards({ xp = 0, gold = 0, energy = 0 }) {
  const updates = {
    gold: increment(gold),
    energy: increment(energy),
  };

  if (xp !== 0) {
    const [snap, levelingConfig] = await Promise.all([getDoc(PLAYER_DOC), getLevelingConfig()]);
    const currentXp = snap.exists() ? snap.data().xp ?? 0 : 0;
    const newXp = currentXp + xp;
    updates.xp = newXp;

    if (levelingConfig.xpThresholds.length > 0) {
      const newLevel = computeLevelForXp(newXp, levelingConfig.xpThresholds);
      updates.level = newLevel;
      if (levelingConfig.rankThresholds.length > 0) {
        updates.rank = computeRankForLevel(newLevel, levelingConfig.rankThresholds);
      }
    }
  }

  await setDoc(PLAYER_DOC, updates, { merge: true });
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
 * Applies the rewards for slaying a monster (gold/xp/energy) to the player
 * doc, and bumps the relevant PlayerStatistics counters + history entry on
 * the separate statistics doc.
 * @param {{id: string, name: string, is_elite?: boolean, xp_to_give_when_defeated?: number, gold_to_give_when_defeated?: number, energy_to_give_when_defeated?: number}} monster
 */
export async function recordMonsterSlain(monster) {
  const rewardXp = monster.xp_to_give_when_defeated ?? 0;
  const rewardGold = monster.gold_to_give_when_defeated ?? 0;
  const rewardEnergy = monster.energy_to_give_when_defeated ?? 0;

  const entry = {
    type: HistoryEntryType.MONSTER,
    id: monster.id,
    name: monster.name,
    link: buildEditLink(HistoryEntryType.MONSTER, monster.id),
    defeatedAt: new Date().toISOString(),
  };

  const statsUpdates = {
    total_xp_gained: increment(rewardXp),
    monster_defeated: increment(1),
    history: arrayUnion(entry),
  };
  if (monster.is_elite) {
    statsUpdates.elite_defeated = increment(1);
  }

  await Promise.all([
    applyRewards({ xp: rewardXp, gold: rewardGold, energy: rewardEnergy }),
    setDoc(STATISTICS_DOC, statsUpdates, { merge: true }),
  ]);
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

  const entry = {
    type: HistoryEntryType.QUEST,
    id: quest.id,
    name: quest.title,
    link: buildEditLink(HistoryEntryType.QUEST, quest.id),
    defeatedAt: new Date().toISOString(),
  };

  await Promise.all([
    applyRewards({ xp: rewardXp, gold: rewardGold, energy: rewardEnergy }),
    setDoc(
      STATISTICS_DOC,
      {
        total_xp_gained: increment(rewardXp),
        objective_claimed: increment(1),
        history: arrayUnion(entry),
      },
      { merge: true }
    ),
  ]);
}
