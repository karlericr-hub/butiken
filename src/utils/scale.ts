import Phaser from 'phaser';

/**
 * Logisk designyta. Allt i spelet ritas i dessa koordinater precis som förr –
 * skärpelyftet sker genom att rendera samma värld till en större duk och sedan
 * skala ned den, inte genom att flytta på något.
 */
export const VIEW_W = 960;
export const VIEW_H = 640;

/**
 * Superscaling-faktor: hur många fysiska pixlar vi renderar per designpixel.
 * Väljs efter skärmens pixeltäthet och hur mycket FIT-läget behöver skala upp
 * duken, så att grafiken blir skarp även på retina-skärmar och stora fönster.
 * Beräknas en gång vid start; kloss till [2, 4] för att alltid supersampla
 * något men hålla texturminnet rimligt.
 */
function computeRenderScale(): number {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(
    window.innerWidth / VIEW_W,
    window.innerHeight / VIEW_H,
  );
  return Phaser.Math.Clamp(Math.ceil(fit * dpr), 2, 4);
}

/** Antal renderpixlar per designpixel. */
export const RENDER_SCALE = computeRenderScale();

/**
 * Invers av superscaling-faktorn. Texturer som genereras i BootScene ritas i
 * full renderupplösning (RENDER_SCALE×) och visas därför i denna skala så att
 * de täcker rätt yta i designkoordinater.
 */
export const INV_SCALE = 1 / RENDER_SCALE;

/**
 * Ställer in scenens kamera så att hela designytan (VIEW_W×VIEW_H) fyller den
 * superskalade duken. Världen ritas fortfarande i designkoordinater medan
 * kameran zoomar upp allt till full renderupplösning.
 */
export function setupHiResCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(VIEW_W / 2, VIEW_H / 2);
}
