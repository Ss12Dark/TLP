import { Rank, isValidRank } from './Rank.js';

export class Player {
  #name;
  #level;
  #rank;
  #xp;
  #gold;
  #energy;

  /**
   * @param {Object} [options]
   * @param {string} [options.name]
   * @param {number} [options.level]
   * @param {string} [options.rank] one of Rank enum values
   * @param {number} [options.xp]
   * @param {number} [options.gold]
   * @param {number} [options.energy]
   */
  constructor({
    name = 'Player',
    level = 1,
    rank = Rank.BEGINNER,
    xp = 0,
    gold = 0,
    energy = 100,
  } = {}) {
    this.name = name;
    this.level = level;
    this.rank = rank;
    this.xp = xp;
    this.gold = gold;
    this.energy = energy;
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    this.#name = String(value);
  }

  get level() {
    return this.#level;
  }

  set level(value) {
    this.#level = Math.max(1, Math.trunc(value));
  }

  get rank() {
    return this.#rank;
  }

  set rank(value) {
    if (!isValidRank(value)) {
      throw new Error(`Invalid rank: ${value}`);
    }
    this.#rank = value;
  }

  get xp() {
    return this.#xp;
  }

  set xp(value) {
    this.#xp = Math.max(0, Number(value));
  }

  get gold() {
    return this.#gold;
  }

  set gold(value) {
    this.#gold = Math.max(0, Math.trunc(value));
  }

  get energy() {
    return this.#energy;
  }

  set energy(value) {
    this.#energy = Math.max(0, Math.trunc(value));
  }

  toJSON() {
    return {
      name: this.#name,
      level: this.#level,
      rank: this.#rank,
      xp: this.#xp,
      gold: this.#gold,
      energy: this.#energy,
    };
  }

  static fromJSON(data) {
    return new Player(data);
  }
}
