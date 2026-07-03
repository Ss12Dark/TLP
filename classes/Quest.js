export class Quest {
  #title;
  #description;
  #xpToGiveWhenDefeated;
  #goldToGiveWhenDefeated;
  #energyToGiveWhenDefeated;

  /**
   * @param {Object} [options]
   * @param {string} [options.title]
   * @param {string} [options.description]
   * @param {number} [options.xp_to_give_when_defeated]
   * @param {number} [options.gold_to_give_when_defeated]
   * @param {number} [options.energy_to_give_when_defeated]
   */
  constructor({
    title = 'Quest',
    description = '',
    xp_to_give_when_defeated = 0,
    gold_to_give_when_defeated = 0,
    energy_to_give_when_defeated = 0,
  } = {}) {
    this.title = title;
    this.description = description;
    this.xpToGiveWhenDefeated = xp_to_give_when_defeated;
    this.goldToGiveWhenDefeated = gold_to_give_when_defeated;
    this.energyToGiveWhenDefeated = energy_to_give_when_defeated;
  }

  get title() {
    return this.#title;
  }

  set title(value) {
    this.#title = String(value);
  }

  get description() {
    return this.#description;
  }

  set description(value) {
    this.#description = String(value);
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
      title: this.#title,
      description: this.#description,
      xp_to_give_when_defeated: this.#xpToGiveWhenDefeated,
      gold_to_give_when_defeated: this.#goldToGiveWhenDefeated,
      energy_to_give_when_defeated: this.#energyToGiveWhenDefeated,
    };
  }

  static fromJSON(data) {
    return new Quest(data);
  }
}
