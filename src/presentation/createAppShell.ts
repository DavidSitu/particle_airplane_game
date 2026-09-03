import type { AppPresenterElements } from './AppPresenter';

export interface AppShell {
  readonly canvasHost: HTMLElement;
  readonly presenterElements: AppPresenterElements;
}

/** Creates the stable DOM hosts. Phaser's canvas is never replaced by UI renders. */
export function createAppShell(root: HTMLElement): AppShell {
  root.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const frame = document.createElement('div');
  frame.className = 'portrait-frame';

  const screenHost = document.createElement('div');
  screenHost.className = 'screen-host';

  const gameLayer = document.createElement('section');
  gameLayer.className = 'game-screen';
  gameLayer.hidden = true;
  gameLayer.setAttribute('aria-label', 'Game arena');

  const canvasHost = document.createElement('div');
  canvasHost.className = 'game-canvas-host';
  canvasHost.dataset.testid = 'game-canvas-host';

  const hudHost = document.createElement('div');
  hudHost.className = 'game-hud-host';

  gameLayer.append(canvasHost, hudHost);
  frame.append(screenHost, gameLayer);
  shell.append(frame);
  root.append(shell);

  return {
    canvasHost,
    presenterElements: { screenHost, gameLayer, hudHost },
  };
}

