export const Rank = Object.freeze({
  BEGINNER: 'Beginner',
  NOVICE: 'Novice',
  FIGHTER: 'Fighter',
  VETERAN: 'Veteran',
  ELITE: 'Elite',
  COMMANDER: 'Commander',
  HERO: 'Hero',
  MASTER: 'Master',
  LEGEND: 'Legend',
  IMMORTAL: 'Immortal',
});

export const RANK_ORDER = Object.freeze(Object.values(Rank));

export function isValidRank(value) {
  return RANK_ORDER.includes(value);
}
