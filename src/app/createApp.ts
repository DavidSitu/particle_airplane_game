import { AssetCatalog, type AssetCatalogPort, type ManifestLoaderPort } from '../systems/assets';
import { AudioCoordinator, type AudioDriverPort, type AudioPreferenceStorePort } from '../systems/audio';
import { CharacterCustomizer } from '../systems/customization';
import type {
  CharacterStorePort,
  ImageProcessorPort,
} from '../systems/customization';
import type {
  PlaneShooterSimulationApi,
  PlaneShooterSimulationOptions,
} from '../systems/gameplay';
import { BrowserAudioDriver } from '../adapters/browser/BrowserAudioDriver';
import { BrowserLifecycleAdapter } from '../adapters/browser/BrowserLifecycleAdapter';
import { CanvasImageProcessor } from '../adapters/browser/CanvasImageProcessor';
import { FetchAssetManifestLoader } from '../adapters/browser/FetchAssetManifestLoader';
import { LocalAudioPreferenceStore } from '../adapters/browser/LocalAudioPreferenceStore';
import { ObjectUrlRegistry } from '../adapters/browser/ObjectUrlRegistry';
import { IndexedDbCharacterStore } from '../adapters/persistence/IndexedDbCharacterStore';
import { MemoryCharacterStore } from '../adapters/persistence/MemoryCharacterStore';
import { PhaserRuntimeAdapter } from '../adapters/phaser/PhaserRuntimeAdapter';
import { AppController, type AppAudioPort, type AppControllerDependencies, type AppLifecyclePort, type AppObjectUrlPort } from './AppController';
import type { GameRuntimePort } from './runtimePort';

export interface CreateAppOptions {
  /** Stable Phaser host, normally the host returned by createAppShell. */
  readonly container?: HTMLElement;
  readonly manifestLoader?: ManifestLoaderPort;
  readonly assets?: AssetCatalogPort;
  readonly audio?: AppAudioPort;
  readonly audioDriver?: AudioDriverPort;
  readonly audioPreferenceStore?: AudioPreferenceStorePort;
  readonly characterStore?: CharacterStorePort;
  readonly fallbackCharacterStore?: CharacterStorePort;
  readonly imageProcessor?: ImageProcessorPort;
  readonly customization?: AppControllerDependencies['customization'];
  readonly objectUrls?: AppObjectUrlPort;
  readonly runtime?: GameRuntimePort;
  readonly lifecycle?: AppLifecyclePort;
  readonly simulationFactory?: (options?: PlaneShooterSimulationOptions) => PlaneShooterSimulationApi;
  readonly gameplayConfig?: AppControllerDependencies['gameplayConfig'];
  readonly sessionIdFactory?: AppControllerDependencies['sessionIdFactory'];
  readonly seedFactory?: AppControllerDependencies['seedFactory'];
  readonly gate?: AppControllerDependencies['gate'];
  readonly fetchImpl?: typeof fetch;
}

const defaultRuntimeContainer = (): HTMLElement => {
  if (typeof document === 'undefined') {
    throw new Error('createApp requires a browser document or an explicit container.');
  }
  const host = document.querySelector<HTMLElement>('[data-testid="game-canvas-host"]') ?? document.body;
  if (!host) throw new Error('createApp could not find a runtime container.');
  return host;
};

/**
 * Composition root for one application instance. Systems and browser
 * adapters are constructed exactly once; tests can replace each boundary
 * without importing presentation or Phaser.
 */
export function createApp(options: CreateAppOptions = {}): AppController {
  const manifestLoader = options.manifestLoader ?? new FetchAssetManifestLoader(
    options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl },
  );
  const assets = options.assets ?? new AssetCatalog(manifestLoader);

  const audio = options.audio ?? new AudioCoordinator({
    catalog: assets,
    driver: options.audioDriver ?? new BrowserAudioDriver(),
    preferenceStore: options.audioPreferenceStore ?? new LocalAudioPreferenceStore(),
  });

  const fallbackCharacterStore = options.fallbackCharacterStore ?? new MemoryCharacterStore();
  const customization = options.customization ?? new CharacterCustomizer({
    imageProcessor: options.imageProcessor ?? new CanvasImageProcessor(),
    store: options.characterStore ?? new IndexedDbCharacterStore(),
    fallbackStore: fallbackCharacterStore,
  });
  const objectUrls = options.objectUrls ?? new ObjectUrlRegistry();
  const runtime = options.runtime ?? new PhaserRuntimeAdapter();

  const holder: { current?: AppController } = {};
  const lifecycle = options.lifecycle ?? new BrowserLifecycleAdapter({
    onHidden: () => {
      void holder.current?.dispatch({ type: 'PAUSE_REQUESTED', source: 'visibility' });
    },
    onVisible: () => {
      const current = holder.current;
      if (current?.state.kind === 'paused' && current.state.source === 'visibility') {
        void current.dispatch({ type: 'RESUME_REQUESTED' });
      }
    },
    onBlur: () => {
      void holder.current?.dispatch({ type: 'PAUSE_REQUESTED', source: 'visibility' });
    },
    onFocus: () => {
      const current = holder.current;
      if (!document.hidden && current?.state.kind === 'paused' && current.state.source === 'visibility') {
        void current.dispatch({ type: 'RESUME_REQUESTED' });
      }
    },
    onPageHide: () => {
      void holder.current?.dispose();
    },
  });

  const controller = new AppController({
    assets,
    audio,
    customization,
    runtime,
    runtimeContainer: options.container ?? defaultRuntimeContainer(),
    objectUrls,
    lifecycle,
    simulationFactory: options.simulationFactory,
    gameplayConfig: options.gameplayConfig,
    sessionIdFactory: options.sessionIdFactory,
    seedFactory: options.seedFactory,
    gate: options.gate,
  });
  holder.current = controller;
  return controller;
}

export default createApp;
