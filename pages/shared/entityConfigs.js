export const monsterConfig = {
  collection: 'monsters',
  singular: 'Monster',
  plural: 'Monsters',
  listPage: 'list.html',
  formPage: 'form.html',
  titleKey: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'is_elite', label: 'Elite', type: 'checkbox' },
    { key: 'xp_to_give_when_defeated', label: 'XP reward', type: 'number', numberType: 'float' },
    { key: 'gold_to_give_when_defeated', label: 'Gold reward', type: 'number', numberType: 'int' },
    { key: 'energy_to_give_when_defeated', label: 'Energy reward', type: 'number', numberType: 'int' },
  ],
  renderCardMeta(item) {
    const badges = [
      item.is_elite ? '<span class="badge badge-elite">Elite</span>' : '<span class="badge">Normal</span>',
      `<span class="badge">XP ${item.xp_to_give_when_defeated ?? 0}</span>`,
      `<span class="badge">Gold ${item.gold_to_give_when_defeated ?? 0}</span>`,
      `<span class="badge">Energy ${item.energy_to_give_when_defeated ?? 0}</span>`,
    ];
    return `<div class="badge-row">${badges.join('')}</div>`;
  },
};

export const questConfig = {
  collection: 'quests',
  singular: 'Quest',
  plural: 'Quests',
  listPage: 'list.html',
  formPage: 'form.html',
  titleKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'xp_to_give_when_defeated', label: 'XP reward', type: 'number', numberType: 'float' },
    { key: 'gold_to_give_when_defeated', label: 'Gold reward', type: 'number', numberType: 'int' },
    { key: 'energy_to_give_when_defeated', label: 'Energy reward', type: 'number', numberType: 'int' },
  ],
  renderCardMeta(item) {
    const badges = [
      `<span class="badge">XP ${item.xp_to_give_when_defeated ?? 0}</span>`,
      `<span class="badge">Gold ${item.gold_to_give_when_defeated ?? 0}</span>`,
      `<span class="badge">Energy ${item.energy_to_give_when_defeated ?? 0}</span>`,
    ];
    return `<div class="badge-row">${badges.join('')}</div>`;
  },
};

export const dungeonConfig = {
  collection: 'dungeons',
  singular: 'Dungeon',
  plural: 'Dungeons',
  listPage: 'list.html',
  formPage: 'form.html',
  titleKey: 'name',
  renderCardMeta(item) {
    const monsterCount = (item.monsterIds ?? []).length;
    const questCount = (item.questIds ?? []).length;
    return `<div class="badge-row">
      <span class="badge">${monsterCount} monster${monsterCount === 1 ? '' : 's'}</span>
      <span class="badge">${questCount} quest${questCount === 1 ? '' : 's'}</span>
    </div>`;
  },
};
