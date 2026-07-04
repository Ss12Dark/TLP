import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../firebase-init.js';

function progressDoc(playerId, dungeonId) {
  return doc(db, 'players', playerId, 'dungeonProgress', dungeonId);
}

const DEFAULT_PROGRESS = { slainMonsterIds: [], completedQuestIds: [] };

/**
 * A player's progress within one dungeon (which of its monsters/quests are
 * done). Kept as a subcollection under the player, not on the shared dungeon
 * doc, so two players fighting in the same dungeon don't affect each other.
 * @returns {Promise<{slainMonsterIds: string[], completedQuestIds: string[]}>}
 */
export async function getDungeonProgress(playerId, dungeonId) {
  const snap = await getDoc(progressDoc(playerId, dungeonId));
  if (!snap.exists()) return { ...DEFAULT_PROGRESS };
  const data = snap.data();
  return {
    slainMonsterIds: data.slainMonsterIds ?? [],
    completedQuestIds: data.completedQuestIds ?? [],
  };
}

/**
 * All of a player's dungeon progress docs, keyed by dungeon id — used to
 * decide which dungeons are already cleared when picking a random one.
 * @returns {Promise<Record<string, {slainMonsterIds: string[], completedQuestIds: string[]}>>}
 */
export async function getAllDungeonProgress(playerId) {
  const snapshot = await getDocs(collection(db, 'players', playerId, 'dungeonProgress'));
  const map = {};
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    map[docSnap.id] = {
      slainMonsterIds: data.slainMonsterIds ?? [],
      completedQuestIds: data.completedQuestIds ?? [],
    };
  });
  return map;
}

export async function updateDungeonProgress(playerId, dungeonId, updates) {
  await setDoc(progressDoc(playerId, dungeonId), updates, { merge: true });
}

export async function resetDungeonProgress(playerId, dungeonId) {
  await setDoc(progressDoc(playerId, dungeonId), { ...DEFAULT_PROGRESS });
}
