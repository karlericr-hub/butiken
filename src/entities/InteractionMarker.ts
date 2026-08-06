import Phaser from 'phaser';
import { isoToScreen, TILE_W, TILE_H } from '../utils/iso';
import { PALETTE, DEPTH } from '../config/theme';

/**
 * En markerad golvruta framför en station. Spelaren klickar på rutan – inte på
 * själva hyllan eller kassan – för att föreståndaren ska gå dit och sköta den.
 */
export class InteractionMarker extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    gridX: number,
    gridY: number,
    tint: number = PALETTE.accent.light,
  ) {
    const pos = isoToScreen(gridX, gridY);
    super(scene, pos.x, pos.y);

    const hw = TILE_W / 2 - 4;
    const hh = TILE_H / 2 - 3;

    const g = scene.add.graphics();
    const diamond = (sw: number, sh: number): void => {
      g.beginPath();
      g.moveTo(0, -sh);
      g.lineTo(sw, 0);
      g.lineTo(0, sh);
      g.lineTo(-sw, 0);
      g.closePath();
    };
    // Två ramar med olika ljusstyrka ger rutan en mjuk, upplyst kant.
    g.fillStyle(tint, 0.2);
    diamond(hw, hh);
    g.fillPath();
    g.lineStyle(4, tint, 0.35);
    diamond(hw, hh);
    g.strokePath();
    g.lineStyle(2, tint, 1);
    diamond(hw - 2, hh - 1);
    g.strokePath();
    this.add(g);

    // Golvdekal – ligger under figurerna men ovanför golvplattorna. Rutan är
    // rent visuell; själva klicket hanteras av scenens klickzon (stationAt),
    // som alltid väljer närmaste station så att man inte råkar träffa fel.
    this.setDepth(DEPTH.marker);

    // Sakta pulsering så att rutan syns som klickbar.
    scene.tweens.add({
      targets: g,
      alpha: 0.5,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.add.existing(this);
  }
}
