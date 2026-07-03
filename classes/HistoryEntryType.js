export const HistoryEntryType = Object.freeze({
  MONSTER: 'monster',
  QUEST: 'quest',
  DUNGEON: 'dungeon',
});

const EDIT_PATH_BY_TYPE = Object.freeze({
  [HistoryEntryType.MONSTER]: 'pages/monsters/form.html',
  [HistoryEntryType.QUEST]: 'pages/quests/form.html',
  [HistoryEntryType.DUNGEON]: 'pages/dungeons/form.html',
});

export function isValidHistoryEntryType(value) {
  return Object.values(HistoryEntryType).includes(value);
}

/**
 * Builds a project-root-relative link to the edit page of the given entity.
 * Callers rendering from a nested page must adjust the relative prefix themselves.
 */
export function buildEditLink(type, id) {
  if (!isValidHistoryEntryType(type)) {
    throw new Error(`Invalid history entry type: ${type}`);
  }
  return `${EDIT_PATH_BY_TYPE[type]}?id=${encodeURIComponent(id)}`;
}
