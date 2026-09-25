import './style.css';
import { Game } from './Game';

const root = document.getElementById('app');
if (!root) throw new Error('Chybí element #app');

try {
  const flags = window as unknown as { __GEODET_START?: 'kancelar' | 'stavba' | 'louka' | 'les'; __GEODET_STEADY?: boolean };
  const game = new Game(root, { start: flags.__GEODET_START, steadyPole: flags.__GEODET_STEADY });
  game.start();
  // Háček pro automatické testy (nastavuje jen testovací harness).
  const w = window as unknown as { __GEODET_TEST?: boolean; __game?: Game };
  if (w.__GEODET_TEST) w.__game = game;
} catch (err) {
  console.error(err);
  root.innerHTML =
    '<div class="fatal">Nepodařilo se spustit 3D zobrazení (WebGL).<br>Zkus jiný prohlížeč nebo zapni hardwarovou akceleraci.</div>';
}

// Offline režim (jen v sestavené verzi, ve vývoji by mezipaměť překážela).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* bez offline režimu hra jede dál */
    });
  });
}
