const zh = {
  title: '王冠弓兵團',
  subtitle: '拉弓射箭，一路稱王！',
  level: (n: number) => `第 ${n} 關`,
  tapToPlay: '開始戰鬥',
  dragHint: '左右拖曳移動軍隊',
  upgrade_army: '初始兵力',
  upgrade_rate: '射速',
  upgrade_damage: '攻擊力',
  upgrade_income: '收益',
  lv: (n: number) => `Lv.${n}`,
  victory: '勝利！',
  defeat: '戰敗',
  survivors: (n: number) => `倖存士兵 ${n}`,
  reached: (p: number) => `推進了 ${p}%`,
  next: '下一關',
  retry: '再試一次',
  home: '主畫面',
  paused: '暫停',
  resume: '繼續',
  settings: '設定',
  sound: '音效',
  music: '音樂',
  haptics: '震動',
  on: '開',
  off: '關',
  privacy: '隱私權政策',
  close: '關閉',
  reward_rapid: '連射 x2',
  reward_multi: '多重箭',
  reward_soldiers: '援軍',
  reward_coins: '金幣',
  boss: '巨人首領',
  bossIncoming: '首領來襲！',
  newRecord: '新紀錄',
  version: '版本',
  restartLevel: '重新開始',
};

type Dict = typeof zh;

const en: Dict = {
  title: 'Crown Archers',
  subtitle: 'Draw your bows. Claim the crown!',
  level: (n) => `Level ${n}`,
  tapToPlay: 'Battle!',
  dragHint: 'Drag left and right to move',
  upgrade_army: 'Army',
  upgrade_rate: 'Fire Rate',
  upgrade_damage: 'Damage',
  upgrade_income: 'Income',
  lv: (n) => `Lv.${n}`,
  victory: 'Victory!',
  defeat: 'Defeated',
  survivors: (n) => `${n} soldiers survived`,
  reached: (p) => `Reached ${p}%`,
  next: 'Next',
  retry: 'Retry',
  home: 'Home',
  paused: 'Paused',
  resume: 'Resume',
  settings: 'Settings',
  sound: 'Sound',
  music: 'Music',
  haptics: 'Haptics',
  on: 'On',
  off: 'Off',
  privacy: 'Privacy Policy',
  close: 'Close',
  reward_rapid: 'Rapid x2',
  reward_multi: 'Multi-shot',
  reward_soldiers: 'Recruits',
  reward_coins: 'Coins',
  boss: 'Giant Chief',
  bossIncoming: 'The boss approaches!',
  newRecord: 'New record',
  version: 'Version',
  restartLevel: 'Restart',
};

const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
export const isZh = lang.startsWith('zh');
export const t: Dict = isZh ? zh : en;

export function formatCount(n: number): string {
  const v = Math.round(n);
  if (v < 10000) return String(v);
  if (v < 1_000_000) return `${(v / 1000).toFixed(v < 100000 ? 1 : 0)}K`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}
