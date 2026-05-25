// CONFIGURAÇÃO E DADOS ESTÁTICOS

export const CONFIG = {
  vdtRate: 100, // $1 = 100 VDT
  gameCost: 50, // Custo em VDT para jogar
  dailyFreeCredits: 200, // Créditos diários
  minTransaction: 10, // Valor mínimo em Dólares
  gameEnergyMax: 3,
  quantumSparksPerVDT: 50,
  vaultRewardVDT: 5,
  energyUnitPriceVDT: 5,
  energyRefillPack: 3
};

// PLANO DE REDE (CONSTANTES)
export const NETWORK_PLAN = [
  { level: 1, percent: 5.0 },
  { level: 2, percent: 2.0 },
  { level: 3, percent: 1.0 },
  { level: 4, percent: 1.0 },
  { level: 5, percent: 0.5 },
  { level: 6, percent: 0.5 },
  { level: 7, percent: 0.5 },
  { level: 8, percent: 0.5 },
  { level: 9, percent: 0.5 },
  { level: 10, percent: 0.5 },
];

export const PLANS = [
  {
    id: 'vdex_doble_x',
    name: 'Vdex Doble X',
    flag: '🇺🇸',
    profile: 'Estratégia Única',
    desc: '💰Até 200% (capital + 100% lucro)\n📈3,3% ao dia útil (Washington)\n�️60 a 61 dias úteis (aprox.)\n✔️Saques de rendimentos todos os dias úteis',
    roiBot: 0,
    roiUser: 200,
    min: 10,
    max: 10000,
    roiTotal: 200,
    duration: 61,
    withdrawEveryDays: 1,
    color: 'border-yellow-400'
  }
];
