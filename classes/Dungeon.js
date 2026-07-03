import { Monster } from './Monster.js';
import { Quest } from './Quest.js';

export class Dungeon {
  #name;
  #monsters;
  #quests;

  /**
   * @param {Object} [options]
   * @param {string} [options.name]
   * @param {Monster[]} [options.monsters]
   * @param {Quest[]} [options.quests]
   */
  constructor({ name = 'Dungeon', monsters = [], quests = [] } = {}) {
    this.name = name;
    this.monsters = monsters;
    this.quests = quests;
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    this.#name = String(value);
  }

  get monsters() {
    return this.#monsters;
  }

  set monsters(value) {
    if (!Array.isArray(value) || !value.every((m) => m instanceof Monster)) {
      throw new Error('monsters must be an array of Monster instances');
    }
    this.#monsters = value;
  }

  get quests() {
    return this.#quests;
  }

  set quests(value) {
    if (!Array.isArray(value) || !value.every((q) => q instanceof Quest)) {
      throw new Error('quests must be an array of Quest instances');
    }
    this.#quests = value;
  }

  addMonster(monster) {
    if (!(monster instanceof Monster)) {
      throw new Error('monster must be a Monster instance');
    }
    this.#monsters.push(monster);
  }

  addQuest(quest) {
    if (!(quest instanceof Quest)) {
      throw new Error('quest must be a Quest instance');
    }
    this.#quests.push(quest);
  }

  toJSON() {
    return {
      name: this.#name,
      monsters: this.#monsters.map((m) => m.toJSON()),
      quests: this.#quests.map((q) => q.toJSON()),
    };
  }

  static fromJSON(data) {
    return new Dungeon({
      name: data.name,
      monsters: (data.monsters ?? []).map((m) => Monster.fromJSON(m)),
      quests: (data.quests ?? []).map((q) => Quest.fromJSON(q)),
    });
  }
}
