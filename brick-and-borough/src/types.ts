export type GamePhase = 'scout' | 'analyze' | 'offer' | 'renovate' | 'exit' | 'complete' | 'finished';

export interface PropertyTemplate {
  id: string;
  address: string;
  neighborhood: string;
  askingPrice: number;
  arv: number;
  rent: number;
  taxes: number;
  condition: number;
  repairs: number;
  sellerFloor: number;
  minOffer: number;
  maxOffer: number;
}

export interface PropertyDeal extends PropertyTemplate {
  offer: number;
  purchasePrice: number;
  renovationSpent: number;
  progress: number;
  owned: boolean;
  loanAmount: number;
  strategy?: 'flip' | 'rental' | 'brrrr';
}

export interface PortfolioEntry {
  address: string;
  neighborhood: string;
  strategy: 'flip' | 'rental' | 'brrrr';
  profit?: number;
  monthlyCashFlow?: number;
  equity?: number;
}

export interface GameState {
  cash: number;
  debt: number;
  equity: number;
  reputation: number;
  phase: GamePhase;
  day: number;
  round: number;
  property: PropertyDeal;
  objective: string;
  portfolio: PortfolioEntry[];
}
