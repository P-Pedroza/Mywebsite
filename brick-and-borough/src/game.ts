import Phaser from 'phaser';
import type { GameState } from './types';

const COLORS = { grass: 0x506b4d, road: 0x4f5657, curb: 0xb9b49f, lot: 0x789168 };
const OUTCOME_COLORS = { flip: 0xcbb98c, rental: 0xd7a15c, brrrr: 0xe4c46a } as const;
const OUTCOME_LABELS = { flip: 'SOLD', rental: 'RENTED', brrrr: 'BRRRR' } as const;
const FUTURE_COLOR = 0x45524c;

const HOMES = [
  { x: 245, y: 270, color: 0xb56c4e },
  { x: 430, y: 195, color: 0xd3b276 },
  { x: 610, y: 280, color: 0x9c6555 },
  { x: 790, y: 205, color: 0x7d9aa1 },
  { x: 340, y: 455, color: 0x76907b },
  { x: 545, y: 485, color: 0xc49461 },
  { x: 760, y: 430, color: 0xb66f5b },
];

export class NeighborhoodScene extends Phaser.Scene {
  private state: GameState;
  private currentHouse?: Phaser.GameObjects.Container;
  private marker?: Phaser.GameObjects.Arc;
  private onSelect: () => void;

  constructor(state: GameState, onSelect: () => void) {
    super('Neighborhood');
    this.state = state;
    this.onSelect = onSelect;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#263a35');
    this.currentHouse = undefined;
    this.marker = undefined;
    this.drawGround();
    HOMES.forEach((home, index) => this.placeHouse(home, index));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const target = p.event.target;
      const overPanel = target instanceof Element && Boolean(target.closest('.panel'));
      if (p.isDown && !overPanel) this.cameras.main.scrollX -= p.velocity.x * 0.7;
    });
  }

  private placeHouse(home: { x: number; y: number; color: number }, index: number): void {
    const round = this.state.round;
    let color = home.color;
    let label: string | undefined;
    let markCurrent = false;

    if (index < round) {
      const entry = this.state.portfolio[index];
      color = entry ? OUTCOME_COLORS[entry.strategy] : home.color;
      label = entry ? OUTCOME_LABELS[entry.strategy] : undefined;
    } else if (index === round && this.state.phase !== 'finished') {
      markCurrent = true;
      if (this.state.property.progress > 0) {
        color = this.state.property.progress === 100 ? 0xe6d2a3 : 0xb99d72;
      }
    } else {
      color = FUTURE_COLOR;
    }

    const house = this.createHouse(home.x, home.y, color, index);

    if (markCurrent) {
      this.currentHouse = house;
      const interactive = this.state.phase === 'scout';
      if (interactive) {
        // Container.setSize(120,110) forces a 0.5/0.5 display origin (60,55) that Phaser
        // adds to the click point before testing the hit area, so the rectangle is offset
        // by that same amount rather than being centered on (0,0).
        house.setInteractive(new Phaser.Geom.Rectangle(5, -20, 110, 100), Phaser.Geom.Rectangle.Contains);
        house.on('pointerover', () => house.setScale(1.04));
        house.on('pointerout', () => house.setScale(1));
        house.on('pointerdown', this.onSelect);
        this.marker = this.add.circle(home.x, home.y + 38, 46, 0xf4d35e, 0.15).setStrokeStyle(3, 0xf4d35e, 0.9);
        this.tweens.add({ targets: this.marker, scale: 1.18, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
        this.add.text(home.x, home.y - 105, 'OPPORTUNITY', {
          fontFamily: 'Arial', fontSize: '11px', fontStyle: 'bold', color: '#17221f', backgroundColor: '#f4d35e', padding: { x: 8, y: 5 },
        }).setOrigin(0.5);
      }
    }

    if (label) {
      this.add.text(home.x, home.y - 105, label, {
        fontFamily: 'Arial', fontSize: '10px', fontStyle: 'bold', color: '#f9f1e2', backgroundColor: '#17221f', padding: { x: 7, y: 4 },
      }).setOrigin(0.5);
    }
  }

  refresh(): void {
    if (!this.currentHouse) return;
    if (this.state.property.progress > 0) {
      const body = this.currentHouse.getByName('body') as Phaser.GameObjects.Polygon;
      body.setFillStyle(this.state.property.progress === 100 ? 0xe6d2a3 : 0xb99d72);
      if (this.marker) this.marker.setStrokeStyle(3, 0x7fd1a5, 0.9);
    }
  }

  rebuild(): void {
    this.children.removeAll(true);
    this.create();
  }

  private drawGround(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.grass).fillRect(0, 0, 1100, 700);
    g.fillStyle(COLORS.road).fillRect(0, 320, 1100, 112).fillRect(500, 0, 115, 700);
    g.fillStyle(COLORS.curb).fillRect(0, 310, 1100, 10).fillRect(0, 432, 1100, 10).fillRect(490, 0, 10, 700).fillRect(615, 0, 10, 700);
    g.lineStyle(3, 0xc8c4a5, 0.55);
    for (let x = 15; x < 1100; x += 55) g.lineBetween(x, 375, x + 28, 375);
    for (let y = 15; y < 700; y += 55) g.lineBetween(557, y, 557, y + 28);
    for (let x = 90; x < 1000; x += 170) this.createTree(x, x % 340 ? 110 : 565);
  }

  private createHouse(x: number, y: number, color: number, index: number): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(6, 34, 125, 45, 0x14201d, 0.24);
    const body = this.add.polygon(0, 0, [-52,-25, 0,-52, 52,-25, 52,30, 0,58, -52,30], color).setName('body');
    const roof = this.add.polygon(0, -26, [-59,0, 0,-34, 59,0, 0,31], index % 2 ? 0x5a504a : 0x4a4643);
    const door = this.add.polygon(18, 14, [-9,-10, 9,-19, 9,14, -9,23], 0x44342c);
    const window = this.add.polygon(-23, 2, [-10,-5, 3,-11, 3,5, -10,12], 0x9fd3d5).setStrokeStyle(2, 0xe9e4c9);
    return this.add.container(x, y, [shadow, body, roof, door, window]).setSize(120, 110);
  }

  private createTree(x: number, y: number): void {
    this.add.ellipse(x + 5, y + 22, 42, 15, 0x1e2d27, 0.2);
    this.add.rectangle(x, y + 8, 8, 34, 0x6c4f35);
    this.add.circle(x, y - 7, 23, 0x315a43);
    this.add.circle(x - 14, y, 16, 0x426d4d);
  }
}

export function createGame(state: GameState, onSelect: () => void): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1100,
    height: 700,
    backgroundColor: '#263a35',
    render: { antialias: true, pixelArt: false },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: new NeighborhoodScene(state, onSelect),
  });
}
