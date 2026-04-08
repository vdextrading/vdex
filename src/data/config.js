// CONFIGURAÇÃO E DADOS ESTÁTICOS

export const CONFIG = {
  vdtRate: 100, // $1 = 100 VDT
  gameCost: 50, // Custo em VDT para jogar
  dailyFreeCredits: 200, // Créditos diários
  minTransaction: 10, // Valor mínimo em Dólares
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
    id: 'alpha_trend', 
    name: 'Alpha Trend Pro', 
    flag: '🇺🇸', 
    profile: 'Estratégia Arrojada',
    desc: '💰100% em 30 dias úteis🗓️\n💸90% do lucro gerado pela IA sobre o capital é distribuido para o investidor.\n💸10% do lucro gerado pela IA sobre o capital é distribuido para o sistema.\n✔️Lucro e capital Disponível\n✔️Saques de rendimentos a cada 10 dias',
    roiBot: 10, // 10%
    roiUser: 90, // 90%
    min: 10,
    max: 5000, 
    roiTotal: 100, 
    duration: 30, // 30 business days
    withdrawEveryDays: 10,
    color: 'border-purple-500'
  },
  { 
    id: 'binary_storm', 
    name: 'Binary Storm X', 
    flag: '🇺🇸',
    profile: 'Estratégia Moderada',
    desc: '💰300% em 90 dias úteis🗓️\n💸280% do lucro gerado pela IA sobre o capital é distribuido para o investidor.\n💸20% do lucro gerado pela IA sobre o capital é distribuido para o sistema.\n✔️Lucro e capital Disponível\n✔️Saques de rendimentos todos os dias',
    roiBot: 20, // 20%
    roiUser: 280, // 280%
    min: 10,
    max: 10000, 
    roiTotal: 300, 
    duration: 90, // 90 business days
    withdrawEveryDays: 1,
    color: 'border-yellow-400'
  }
];
