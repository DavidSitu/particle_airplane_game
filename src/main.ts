import './styles/main.css';
import { createApp } from './app/createApp';
import { AppPresenter } from './presentation/AppPresenter';
import { createAppShell } from './presentation/createAppShell';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('The application root is missing.');

const shell = createAppShell(root);
const controller = createApp({ container: shell.canvasHost });
const presenter = new AppPresenter(controller, shell.presenterElements);

void controller.boot();

const dispose = (): void => {
  presenter.dispose();
  void controller.dispose();
};

window.addEventListener('pagehide', dispose, { once: true });
import.meta.hot?.dispose(dispose);

