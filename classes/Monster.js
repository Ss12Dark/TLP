export class Monster {
  #name;
  #description;
  #isElite;
  #xpToGiveWhenDefeated;
  #goldToGiveWhenDefeated;
  #energyToGiveWhenDefeated;

  /**
   * @param {Object} [options]
   * @param {string} [options.name]
   * @param {string} [options.description]
   * @param {boolean} [options.is_elite]
   * @param {number} [options.xp_to_give_when_defeated]
   * @param {number} [options.gold_to_give_when_defeated]
   * @param {number} [options.energy_to_give_when_defeated]
   */
  constructor({
    name = 'Monster',
    description = '',
    is_elite = false,
    xp_to_give_when_defeated = 0,
    gold_to_give_when_defeated = 0,
    energy_to_give_when_defeated = 0,
  } = {}) {
    this.name = name;
    this.description = description;
    this.isElite = is_elite;
    this.xpToGiveWhenDefeated = xp_to_give_when_defeated;
    this.goldToGiveWhenDefeated = gold_to_give_when_defeated;
    this.energyToGiveWhenDefeated = energy_to_give_when_defeated;
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    this.#name = String(value);
  }

  get description() {
    return this.#description;
  }

  set description(value) {
    this.#description = String(value);
  }

  get isElite() {
    return this.#isElite;
  }

  set isElite(value) {
    this.#isElite = Boolean(value);
  }

  get xpToGiveWhenDefeated() {
    return this.#xpToGiveWhenDefeated;
  }

  set xpToGiveWhenDefeated(value) {
    this.#xpToGiveWhenDefeated = Math.max(0, Number(value));
  }

  get goldToGiveWhenDefeated() {
    return this.#goldToGiveWhenDefeated;
  }

  set goldToGiveWhenDefeated(value) {
    this.#goldToGiveWhenDefeated = Math.max(0, Math.trunc(value));
  }

  get energyToGiveWhenDefeated() {
    return this.#energyToGiveWhenDefeated;
  }

  set energyToGiveWhenDefeated(value) {
    this.#energyToGiveWhenDefeated = Math.max(0, Math.trunc(value));
  }

  toJSON() {
    return {
      name: this.#name,
      description: this.#description,
      is_elite: this.#isElite,
      xp_to_give_when_defeated: this.#xpToGiveWhenDefeated,
      gold_to_give_when_defeated: this.#goldToGiveWhenDefeated,
      energy_to_give_when_defeated: this.#energyToGiveWhenDefeated,
    };
  }

  static fromJSON(data) {
    return new Monster(data);
  }
}
