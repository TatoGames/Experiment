(function (root) {
  var data = {
    plants: [
      { id: 'sprout', name: '새싹', baseCost: 10, incomePerSec: 0.1, costGrowth: 1.1 },
      { id: 'fern', name: '고사리', baseCost: 90, incomePerSec: 0.9, costGrowth: 1.1 },
      { id: 'herb', name: '허브', baseCost: 570, incomePerSec: 4.5, costGrowth: 1.1 },
      { id: 'rose', name: '장미', baseCost: 3420, incomePerSec: 18, costGrowth: 1.1 },
      { id: 'orchid', name: '난초', baseCost: 20700, incomePerSec: 69, costGrowth: 1.1 },
      { id: 'bonsai', name: '분재', baseCost: 120750, incomePerSec: 297, costGrowth: 1.1 }
    ],
    upgrades: [
      { id: 'soil', name: '좋은 흙', cost: 450, multiplier: 1.4 },
      { id: 'light', name: '식물 조명', cost: 4050, multiplier: 1.8 },
      { id: 'mist', name: '자동 분무기', cost: 45000, multiplier: 2.2 }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.GreenData = data;
})(typeof window !== 'undefined' ? window : globalThis);
