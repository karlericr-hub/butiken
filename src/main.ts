import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { EveningScene } from './scenes/EveningScene';
import { GameOverScene } from './scenes/GameOverScene';
import { RENDER_SCALE, VIEW_W, VIEW_H } from './utils/scale';

/**
 * All text renderas i full renderupplösning (RENDER_SCALE×) så att bokstäverna
 * blir skarpa när kameran zoomar upp världen. Vi ersätter standardfabriken för
 * `add.text` så att varje textobjekt får rätt upplösning utan att varje
 * anropsställe behöver ändras.
 */
Phaser.GameObjects.GameObjectFactory.register(
  'text',
  function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ) {
    const label = new Phaser.GameObjects.Text(this.scene, x, y, text, style ?? {});
    label.setResolution(RENDER_SCALE);
    this.displayList.add(label);
    return label;
  },
);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  // Duken renderas i full renderupplösning; FIT skalar sedan ned den till
  // fönstret. Världen ritas fortfarande i VIEW_W×VIEW_H via kamerans zoom.
  width: VIEW_W * RENDER_SCALE,
  height: VIEW_H * RENDER_SCALE,
  parent: 'game',
  backgroundColor: '#9fd6e8',
  scale: {
    mode: Phaser.Scale.FIT,
    // Centreringen sköts av #game (flexbox i index.html). Phasers egen
    // autoCenter skulle lägga marginaler ovanpå flex-centreringen, vilket
    // dubbelcentrerar och skjuter duken ur läge på breda mobilskärmar.
    autoCenter: Phaser.Scale.NO_CENTER,
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
