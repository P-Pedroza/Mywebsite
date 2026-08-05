import type { GameState, PortfolioEntry, PropertyDeal, PropertyTemplate } from './types';

export const PROPERTY_POOL: PropertyTemplate[] = [
  {
    id: 'linwood-609',
    address: '609 N Linwood Ave',
    neighborhood: 'Near Eastside',
    askingPrice: 85000,
    arv: 140000,
    rent: 1225,
    taxes: 1400,
    condition: 42,
    repairs: 17000,
    sellerFloor: 74000,
    minOffer: 53500,
    maxOffer: 86500,
  },
  {
    id: 'shelby-1420',
    address: '1420 Shelby St',
    neighborhood: 'Fountain Square',
    askingPrice: 97500,
    arv: 161000,
    rent: 1425,
    taxes: 1610,
    condition: 50,
    repairs: 19500,
    sellerFloor: 85000,
    minOffer: 61500,
    maxOffer: 99500,
  },
  {
    id: 'audubon-215',
    address: '215 N Audubon Rd',
    neighborhood: 'Irvington',
    askingPrice: 112500,
    arv: 185000,
    rent: 1625,
    taxes: 1850,
    condition: 55,
    repairs: 22500,
    sellerFloor: 98000,
    minOffer: 71000,
    maxOffer: 114500,
  },
  {
    id: 'riverside-88',
    address: '88 Riverside Dr',
    neighborhood: 'Riverside',
    askingPrice: 129500,
    arv: 213000,
    rent: 1875,
    taxes: 2130,
    condition: 38,
    repairs: 26000,
    sellerFloor: 112500,
    minOffer: 81500,
    maxOffer: 132000,
  },
  {
    id: 'garfield-742',
    address: '742 Cruft St',
    neighborhood: 'Garfield Park',
    askingPrice: 148500,
    arv: 245000,
    rent: 2150,
    taxes: 2450,
    condition: 60,
    repairs: 29500,
    sellerFloor: 129500,
    minOffer: 93500,
    maxOffer: 151500,
  },
  {
    id: 'brightwood-33',
    address: '33 E 25th St',
    neighborhood: 'Martindale-Brightwood',
    askingPrice: 171000,
    arv: 282000,
    rent: 2475,
    taxes: 2820,
    condition: 45,
    repairs: 34000,
    sellerFloor: 148500,
    minOffer: 107500,
    maxOffer: 174500,
  },
  {
    id: 'kessler-501',
    address: '501 E Kessler Blvd',
    neighborhood: 'Meridian-Kessler',
    askingPrice: 196500,
    arv: 324000,
    rent: 2850,
    taxes: 3240,
    condition: 70,
    repairs: 39500,
    sellerFloor: 171000,
    minOffer: 124000,
    maxOffer: 200500,
  },
];

const templateToDeal = (template: PropertyTemplate): PropertyDeal => ({
  ...template,
  offer: Math.min(template.maxOffer, Math.ceil((template.sellerFloor + 1500) / 500) * 500),
  purchasePrice: 0,
  renovationSpent: 0,
  progress: 0,
  owned: false,
  loanAmount: 0,
});

export const initialState = (): GameState => ({
  cash: 65000,
  debt: 0,
  equity: 0,
  reputation: 12,
  phase: 'scout',
  day: 1,
  round: 0,
  property: templateToDeal(PROPERTY_POOL[0]),
  objective: `Find your first opportunity (Deal 1 of ${PROPERTY_POOL.length})`,
  portfolio: [],
});

function clampReputation(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function recomputeEquity(state: GameState): number {
  const heldEquity = state.portfolio.reduce((sum, entry) => sum + (entry.equity ?? 0), 0);
  const inProgress = state.phase === 'renovate' || state.phase === 'exit';
  const currentEquity = state.property.owned && inProgress
    ? Math.max(0, state.property.arv - state.property.loanAmount)
    : 0;
  return heldEquity + currentEquity;
}

function advanceDays(state: GameState, days: number): void {
  const flow = totalMonthlyCashFlow(state);
  if (flow !== 0) state.cash += Math.round((flow * days) / 30);
  state.day += days;
}

export function submitOffer(state: GameState, amount: number): { accepted: boolean; message: string } {
  const template = PROPERTY_POOL[state.round];
  const closingCost = Math.round(amount * 0.25) + 2200;
  if (state.cash < closingCost) {
    return {
      accepted: false,
      message: `You need ${money(closingCost)} on hand for the down payment and closing costs — you have ${money(state.cash)}.`,
    };
  }
  state.property.offer = amount;
  advanceDays(state, 2);
  if (amount < template.sellerFloor) {
    state.reputation = clampReputation(state.reputation - 1);
    return { accepted: false, message: `Seller countered. They need at least ${money(template.sellerFloor)} to move quickly.` };
  }
  const loanAmount = Math.round(amount * 0.75);
  state.property.purchasePrice = amount;
  state.property.loanAmount = loanAmount;
  state.property.owned = true;
  state.cash -= closingCost;
  state.debt += loanAmount;
  state.phase = 'renovate';
  state.objective = 'Complete the renovation';
  return { accepted: true, message: `Accepted! You closed at ${money(amount)} with 25% down.` };
}

export function renovate(state: GameState, scope: 'essential' | 'full'): string {
  const p = state.property;
  const essentialCost = Math.round((p.repairs * 0.75) / 500) * 500;
  const fullCost = Math.round((p.repairs * 1.05) / 500) * 500;
  const cost = scope === 'essential' ? essentialCost : fullCost;
  if (state.cash < cost) return `You need ${money(cost)} in available cash for this renovation.`;
  state.cash -= cost;
  p.renovationSpent += cost;
  p.progress = scope === 'essential' ? 78 : 100;
  p.condition = Math.min(100, p.condition + (scope === 'essential' ? 40 : 55));
  advanceDays(state, scope === 'essential' ? 35 : 52);
  state.phase = 'exit';
  state.objective = 'Choose your exit strategy';
  state.equity = recomputeEquity(state);
  return scope === 'essential'
    ? 'Essential rehab complete. It is rentable, but resale value is limited.'
    : 'Full renovation complete. The property is market-ready.';
}

export function chooseExit(state: GameState, strategy: 'flip' | 'rental' | 'brrrr'): string {
  const p = state.property;
  p.strategy = strategy;
  state.reputation = clampReputation(state.reputation + (strategy === 'flip' ? 8 : 10) + state.round);

  let message: string;
  let entry: PortfolioEntry;
  if (strategy === 'flip') {
    const salePrice = p.progress === 100 ? p.arv : Math.round(p.arv * 0.9);
    const costs = Math.round(salePrice * 0.075);
    const proceeds = salePrice - costs - p.loanAmount;
    state.cash += proceeds;
    state.debt -= p.loanAmount;
    entry = { address: p.address, neighborhood: p.neighborhood, strategy, profit: proceeds };
    message = `Sold for ${money(salePrice)}. After debt and selling costs, ${money(proceeds)} is yours.`;
  } else if (strategy === 'brrrr') {
    const newLoan = Math.round(p.arv * 0.7);
    const recovered = Math.max(0, newLoan - p.loanAmount - 2500);
    state.cash += recovered;
    state.debt += newLoan - p.loanAmount;
    p.loanAmount = newLoan;
    const flow = monthlyCashFlow(p.rent, p.taxes, p.loanAmount);
    entry = { address: p.address, neighborhood: p.neighborhood, strategy, monthlyCashFlow: flow, equity: p.arv - p.loanAmount };
    message = `Refinanced at 70% LTV and recovered ${money(recovered)} while keeping the rental.`;
  } else {
    const flow = monthlyCashFlow(p.rent, p.taxes, p.loanAmount);
    entry = { address: p.address, neighborhood: p.neighborhood, strategy, monthlyCashFlow: flow, equity: p.arv - p.loanAmount };
    message = `Tenant placed at ${money(p.rent)}/month. Estimated cash flow: ${money(flow)}/month.`;
  }
  state.portfolio.push(entry);
  state.phase = 'complete';
  state.objective = state.round >= PROPERTY_POOL.length - 1 ? 'Campaign complete — review your portfolio' : 'First deal complete — keep building';
  state.equity = recomputeEquity(state);
  return message;
}

export function advanceRound(state: GameState): void {
  state.round += 1;
  if (state.round < PROPERTY_POOL.length) {
    state.property = templateToDeal(PROPERTY_POOL[state.round]);
    state.phase = 'scout';
    state.objective = `Scout your next opportunity (Deal ${state.round + 1} of ${PROPERTY_POOL.length})`;
  } else {
    state.phase = 'finished';
    state.objective = 'Campaign complete — review your portfolio';
  }
  state.equity = recomputeEquity(state);
}

export function monthlyCashFlow(rent: number, taxes: number, loanAmount: number): number {
  const loanPayment = loanAmount * 0.008;
  const operating = rent * 0.18 + taxes / 12;
  return Math.round(rent - loanPayment - operating);
}

export function totalMonthlyCashFlow(state: GameState): number {
  return state.portfolio.reduce((sum, entry) => sum + (entry.monthlyCashFlow ?? 0), 0);
}

export function netWorth(state: GameState): number {
  return state.cash + state.equity;
}

export const money = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
