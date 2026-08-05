import './style.css';
import { playAccept, playBuild, playCash, playClick, playReject, setMuted } from './audio';
import { createGame, NeighborhoodScene } from './game';
import {
  PROPERTY_POOL,
  advanceRound,
  chooseExit,
  initialState,
  money,
  netWorth,
  renovate,
  submitOffer,
  totalMonthlyCashFlow,
} from './simulation';
import type { GameState } from './types';

const SAVE_KEY = 'brick-and-borough-save-v2';
const BEST_KEY = 'brick-and-borough-best-v1';
let state: GameState = load();
let lastRound = state.round;
const panel = document.querySelector<HTMLDivElement>('#panel')!;
const stats = document.querySelector<HTMLDivElement>('#stats')!;
const objective = document.querySelector<HTMLDivElement>('#objectives')!;
const toastEl = document.querySelector<HTMLDivElement>('#toast')!;

const game = createGame(state, () => {
  if (state.phase === 'scout') state.phase = 'analyze';
  render();
});

function load(): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    return saved ? (JSON.parse(saved) as GameState) : initialState();
  } catch {
    return initialState();
  }
}

function save(showToast = true): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  if (showToast) toast('Game saved locally');
}

function getBestNetWorth(): number {
  return Number(localStorage.getItem(BEST_KEY) ?? 0);
}

function setBestNetWorth(value: number): void {
  localStorage.setItem(BEST_KEY, String(value));
}

function marketLabel(): { text: string; color: string } {
  const p = state.property;
  const allIn = (p.purchasePrice || p.offer) + p.repairs + 2200;
  const marginRatio = (p.arv - allIn) / p.arv;
  if (marginRatio > 0.28) return { text: "BUYER'S MARKET", color: '#7fd1a5' };
  if (marginRatio > 0.15) return { text: 'BALANCED MARKET', color: '#d9a441' };
  return { text: "SELLER'S MARKET", color: '#c26c57' };
}

function render(): void {
  const flow = totalMonthlyCashFlow(state);
  stats.innerHTML = `
    <div><small>CASH</small><strong>${money(state.cash)}</strong></div>
    <div><small>MONTHLY FLOW</small><strong class="${flow >= 0 ? 'positive' : ''}">${flow >= 0 ? '+' : ''}${money(flow)}</strong></div>
    <div><small>DEBT</small><strong>${money(state.debt)}</strong></div>
    <div><small>EQUITY</small><strong>${money(state.equity)}</strong></div>
    <div><small>REPUTATION</small><strong>${state.reputation}<span>/100</span></strong></div>`;
  const dealNumber = state.phase === 'finished' ? '✓' : String(state.round + 1);
  objective.innerHTML = `<span>${dealNumber}</span><div><small>CURRENT OBJECTIVE</small><strong>${state.objective}</strong><p>${objectiveHint()}</p></div>`;
  const date = new Date(2026, 3, state.day);
  document.querySelector('#date')!.textContent = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const market = marketLabel();
  const marketDot = document.querySelector<HTMLSpanElement>('#market-dot');
  const marketText = document.querySelector<HTMLElement>('#market-label');
  if (marketDot) marketDot.style.background = market.color;
  if (marketText) marketText.textContent = market.text;
  renderPanel();
  const scene = game.scene.getScene('Neighborhood') as NeighborhoodScene | undefined;
  if (scene) {
    if (lastRound !== state.round) {
      scene.rebuild();
      lastRound = state.round;
    } else {
      scene.refresh();
    }
  }
}

function objectiveHint(): string {
  if (state.phase === 'finished') return 'Review your completed portfolio below.';
  if (state.phase === 'scout') return `Deal ${state.round + 1} of ${PROPERTY_POOL.length} · Select the yellow property marker.`;
  return `${state.property.address} · ${state.property.neighborhood}`;
}

function renderPanel(): void {
  if (state.phase === 'scout') {
    panel.classList.remove('open');
    panel.innerHTML = '';
    return;
  }
  panel.classList.add('open');
  if (state.phase === 'finished') {
    panel.innerHTML = phaseContent();
    bindPanelActions();
    return;
  }
  const p = state.property;
  const allIn = (p.purchasePrice || p.offer) + p.repairs + 2200;
  const spread = p.arv - allIn;
  panel.innerHTML = `
    <button class="close" id="close" aria-label="Close property panel">×</button>
    <div class="property-heading"><small>DISTRESSED SINGLE-FAMILY</small><h1>${p.address}</h1><p>${p.neighborhood} · Indianapolis, IN</p></div>
    <div class="condition"><span>CONDITION</span><div><i style="width:${p.condition}%"></i></div><strong>${p.condition}/100</strong></div>
    <div class="metrics">
      <div><small>ASKING</small><strong>${money(p.askingPrice)}</strong></div>
      <div><small>EST. ARV</small><strong>${money(p.arv)}</strong></div>
      <div><small>EST. RENT</small><strong>${money(p.rent)}<em>/mo</em></strong></div>
      <div><small>REPAIRS</small><strong>${money(p.repairs)}</strong></div>
    </div>
    ${phaseContent()}
    <details><summary>Deal breakdown</summary>
      <dl><div><dt>Projected all-in cost</dt><dd>${money(allIn)}</dd></div><div><dt>Potential value spread</dt><dd class="positive">${money(spread)}</dd></div><div><dt>Annual property taxes</dt><dd>${money(p.taxes)}</dd></div></dl>
      <p class="fineprint">Estimates include $2,200 closing costs. Market values and repairs can change.</p>
    </details>`;
  bindPanelActions();
}

function phaseContent(): string {
  const p = state.property;
  if (state.phase === 'analyze' || state.phase === 'offer') return `
    <section class="action-card"><div class="section-title"><span>1</span><div><strong>Make your offer</strong><small>Seller wants speed over top dollar</small></div></div>
      <label>Offer amount <input id="offer-input" type="number" min="${p.minOffer}" max="${p.maxOffer}" step="500" value="${p.offer}"></label>
      <div class="offer-scale"><span>${money(p.minOffer)}</span><span>${money(p.maxOffer)}</span></div>
      <button class="primary" id="offer-btn">Submit offer</button>
      <p class="finance-note">25% down · 9.5% investor loan · $2,200 closing costs</p>
    </section>`;
  if (state.phase === 'renovate') return `
    <section class="action-card"><div class="section-title"><span>2</span><div><strong>Choose renovation scope</strong><small>Balance speed, cost, and resale value</small></div></div>
      <button class="choice" data-renovate="essential"><span><strong>Essential rehab</strong><small>35 days · Rent-ready condition</small></span><b>${money(Math.round((p.repairs * 0.75) / 500) * 500)}</b></button>
      <button class="choice recommended" data-renovate="full"><span><strong>Full renovation</strong><small>52 days · Maximum ARV</small></span><b>${money(Math.round((p.repairs * 1.05) / 500) * 500)}</b></button>
    </section>`;
  if (state.phase === 'exit') return `
    <section class="action-card"><div class="section-title"><span>3</span><div><strong>Choose your strategy</strong><small>The same property can build wealth three ways</small></div></div>
      <button class="choice" data-exit="flip"><span><strong>Fix & flip</strong><small>Sell now and realize profit</small></span><b>FAST CASH</b></button>
      <button class="choice" data-exit="rental"><span><strong>Rent & hold</strong><small>Keep equity and monthly income</small></span><b>${money(p.rent)}/MO</b></button>
      <button class="choice recommended" data-exit="brrrr"><span><strong>BRRRR</strong><small>Refinance, recover capital, keep rental</small></span><b>70% LTV</b></button>
    </section>`;
  if (state.phase === 'complete') {
    const isLast = state.round >= PROPERTY_POOL.length - 1;
    const last = state.portfolio[state.portfolio.length - 1];
    return `
      <section class="success"><div class="seal">✓</div><small>DEAL ${state.round + 1} COMPLETE</small>
        <h2>${last.strategy === 'flip' ? 'Profitable exit' : 'Portfolio growing'}</h2>
        <p>${last.strategy === 'flip' ? `Sold for a ${money(last.profit ?? 0)} profit.` : `Cash flow locked in at ${money(last.monthlyCashFlow ?? 0)}/month.`}</p>
        <button data-advance>${isLast ? 'View final portfolio' : 'Scout your next deal'}</button>
      </section>`;
  }
  const worth = netWorth(state);
  const best = getBestNetWorth();
  const isNewBest = worth > best;
  if (isNewBest) setBestNetWorth(worth);
  const rows = state.portfolio.map(entry => `
    <div><dt>${entry.address}</dt><dd>${entry.strategy.toUpperCase()}${entry.profit !== undefined ? ` · ${money(entry.profit)} profit` : entry.monthlyCashFlow !== undefined ? ` · ${money(entry.monthlyCashFlow)}/mo` : ''}</dd></div>`).join('');
  return `
    <section class="success"><div class="seal">✓</div><small>CAMPAIGN COMPLETE</small>
      <h2>${money(worth)} net worth</h2>
      <p>You built a ${state.portfolio.length}-property portfolio across Indianapolis.${isNewBest ? ' New personal best!' : ` Best run: ${money(Math.max(best, worth))}.`}</p>
      <dl class="portfolio-list">${rows}</dl>
      <button id="restart">Start new campaign</button>
    </section>`;
}

function bindPanelActions(): void {
  document.querySelector('#close')?.addEventListener('click', () => panel.classList.remove('open'));
  document.querySelector('#offer-btn')?.addEventListener('click', () => {
    const amount = Number((document.querySelector('#offer-input') as HTMLInputElement).value);
    const result = submitOffer(state, amount);
    toast(result.message, result.accepted ? 'success' : 'warning');
    result.accepted ? playAccept() : playReject();
    state.phase = result.accepted ? 'renovate' : 'offer';
    render();
    save(false);
  });
  document.querySelectorAll<HTMLElement>('[data-renovate]').forEach(button => button.addEventListener('click', () => {
    toast(renovate(state, button.dataset.renovate as 'essential' | 'full'), 'success');
    playBuild();
    render();
    save(false);
  }));
  document.querySelectorAll<HTMLElement>('[data-exit]').forEach(button => button.addEventListener('click', () => {
    toast(chooseExit(state, button.dataset.exit as 'flip' | 'rental' | 'brrrr'), 'success');
    playCash();
    render();
    save(false);
  }));
  document.querySelector('[data-advance]')?.addEventListener('click', () => {
    advanceRound(state);
    playClick();
    render();
    save(false);
  });
  document.querySelector('#restart')?.addEventListener('click', () => {
    state = initialState();
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  });
}

let toastTimer = 0;
function toast(message: string, type = ''): void {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastEl.className = 'toast'), 4200);
}

document.querySelector('#save')!.addEventListener('click', () => save());
document.querySelector('#sound')!.addEventListener('click', event => {
  const button = event.currentTarget as HTMLElement;
  const isMuted = button.classList.toggle('muted');
  setMuted(isMuted);
  if (!isMuted) playClick();
  toast(isMuted ? 'Sound muted' : 'Sound on');
});
document.querySelector('#brand')!.addEventListener('click', () => toast(`Brick & Borough · ${PROPERTY_POOL.length}-deal campaign`));
render();
