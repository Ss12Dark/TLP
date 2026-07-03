import { isValidHistoryEntryType, buildEditLink } from './HistoryEntryType.js';

function isValidHistoryEntry(entry) {
  return (
    entry &&
    typeof entry === 'object' &&
    isValidHistoryEntryType(entry.type) &&
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.link === 'string'
  );
}

export class PlayerStatistics {
  #monsterDefeated;
  #eliteDefeated;
  #objectiveClaimed;
  #energyWasted;
  #totalXpGained;
  #history;

  /**
   * @param {Object} [options]
   * @param {number} [options.monster_defeated]
   * @param {number} [options.elite_defeated]
   * @param {number} [options.objective_claimed]
   * @param {number} [options.energy_wasted]
   * @param {number} [options.total_xp_gained]
   * @param {Array<{type: string, id: string, name: string, link: string, defeatedAt: string}>} [options.history]
   */
  constructor({
    monster_defeated = 0,
    elite_defeated = 0,
    objective_claimed = 0,
    energy_wasted = 0,
    total_xp_gained = 0,
    history = [],
  } = {}) {
    this.monsterDefeated = monster_defeated;
    this.eliteDefeated = elite_defeated;
    this.objectiveClaimed = objective_claimed;
    this.energyWasted = energy_wasted;
    this.totalXpGained = total_xp_gained;
    this.history = history;
  }

  get monsterDefeated() {
    return this.#monsterDefeated;
  }

  set monsterDefeated(value) {
    this.#monsterDefeated = Math.max(0, Math.trunc(value));
  }

  get eliteDefeated() {
    return this.#eliteDefeated;
  }

  set eliteDefeated(value) {
    this.#eliteDefeated = Math.max(0, Math.trunc(value));
  }

  get objectiveClaimed() {
    return this.#objectiveClaimed;
  }

  set objectiveClaimed(value) {
    this.#objectiveClaimed = Math.max(0, Math.trunc(value));
  }

  get energyWasted() {
    return this.#energyWasted;
  }

  set energyWasted(value) {
    this.#energyWasted = Math.max(0, Math.trunc(value));
  }

  get totalXpGained() {
    return this.#totalXpGained;
  }

  set totalXpGained(value) {
    this.#totalXpGained = Math.max(0, Math.trunc(value));
  }

  get history() {
    return this.#history;
  }

  set history(value) {
    if (!Array.isArray(value) || !value.every(isValidHistoryEntry)) {
      throw new Error('history must be an array of valid history entries');
    }
    this.#history = value;
  }

  /**
   * Records a slain monster / claimed quest / cleared dungeon in the history log.
   * @param {Object} options
   * @param {string} options.type one of HistoryEntryType
   * @param {string} options.id id of the slain entity, used to build the edit link
   * @param {string} options.name display name of the slain entity
   * @param {string} [options.defeatedAt] ISO timestamp, defaults to now
   * @returns {Object} the created history entry
   */
  addHistoryEntry({ type, id, name, defeatedAt = new Date().toISOString() }) {
    if (!isValidHistoryEntryType(type)) {
      throw new Error(`Invalid history entry type: ${type}`);
    }
    const entry = {
      type,
      id: String(id),
      name: String(name),
      link: buildEditLink(type, id),
      defeatedAt,
    };
    this.#history.push(entry);
    return entry;
  }

  toJSON() {
    return {
      monster_defeated: this.#monsterDefeated,
      elite_defeated: this.#eliteDefeated,
      objective_claimed: this.#objectiveClaimed,
      energy_wasted: this.#energyWasted,
      total_xp_gained: this.#totalXpGained,
      history: this.#history,
    };
  }

  static fromJSON(data) {
    return new PlayerStatistics(data);
  }
}
