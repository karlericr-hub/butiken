import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { EveningScene } from './scenes/EveningScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  parent: 'game',
  backgroundColor: '#9fd6e8',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, EveningScene, GameOverScene],
};

/**
 * Väntar in typsnittet innan spelet startar så att texterna renderas med
 * rätt font direkt (Phaser cachar texturerna vid första ritningen).
 */
function startGame(): void {
  new Phaser.Game(config);
}

const fonts = document.fonts;
if (fonts && fonts.load) {
  Promise.all([fonts.load('600 16px "Baloo 2"'), fonts.load('800 16px "Baloo 2"')])
    .catch(() => undefined)
    .finally(startGame);
} else {
  startGame();
}
