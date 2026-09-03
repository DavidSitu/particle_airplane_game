import type {
  AppCommand,
  AppControllerPort,
  AppState,
} from '../app/contracts';
import type {
  CharacterSkinRef,
  CropSettings,
  CustomAssetRecord,
  CustomizationSnapshot,
} from '../systems/customization';

export interface AppPresenterElements {
  readonly screenHost: HTMLElement;
  readonly gameLayer: HTMLElement;
  readonly hudHost: HTMLElement;
}

interface PendingUpload {
  readonly role: 'player' | 'enemy';
  readonly file: File;
  readonly previewUrl: string;
  crop: CropSettings;
}

/**
 * Owns DOM rendering and browser events. Product state stays in AppController;
 * the only presenter-local state is an unsaved upload preview.
 */
export class AppPresenter {
  private readonly unsubscribe: () => void;
  private pendingUpload?: PendingUpload;
  private uploadQueue: File[] = [];
  private savingUpload = false;
  private latestState: Readonly<AppState>;
  private renderedKind?: AppState['kind'];
  private disposed = false;

  public constructor(
    private readonly controller: AppControllerPort,
    private readonly elements: AppPresenterElements,
  ) {
    this.latestState = controller.state;
    elements.screenHost.addEventListener('click', this.handleClick);
    elements.screenHost.addEventListener('change', this.handleChange);
    elements.screenHost.addEventListener('input', this.handleInput);
    elements.screenHost.addEventListener('submit', this.handleSubmit);
    elements.hudHost.addEventListener('click', this.handleClick);
    this.render(this.latestState);
    this.unsubscribe = controller.subscribe((state) => {
      if (this.disposed) return;
      this.latestState = state;
      this.render(state);
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.elements.screenHost.removeEventListener('click', this.handleClick);
    this.elements.screenHost.removeEventListener('change', this.handleChange);
    this.elements.screenHost.removeEventListener('input', this.handleInput);
    this.elements.screenHost.removeEventListener('submit', this.handleSubmit);
    this.elements.hudHost.removeEventListener('click', this.handleClick);
    this.clearPendingUpload();
  }

  private render(state: Readonly<AppState>): void {
    if (state.kind !== 'customizing') this.clearPendingUpload();
    const isGame = state.kind === 'playing' || state.kind === 'paused' || state.kind === 'game-over';
    const sameGameSurface = isGame && this.renderedKind === state.kind;
    this.renderedKind = state.kind;
    this.elements.gameLayer.hidden = !isGame;
    this.elements.screenHost.hidden = isGame;

    if (isGame) {
      this.elements.screenHost.replaceChildren();
      if (sameGameSurface) this.updateGameHud(state);
      else this.renderGameHud(state);
      return;
    }

    this.elements.hudHost.replaceChildren();
    switch (state.kind) {
      case 'booting':
        this.renderLoading(state.message);
        break;
      case 'opening':
        this.renderOpening(state);
        break;
      case 'gate':
        this.renderGate(state);
        break;
      case 'rejected':
        this.renderRejected(state);
        break;
      case 'customizing':
        this.renderCustomizer(state);
        break;
      case 'loading-game':
        this.renderLoading(state.message);
        break;
      case 'fatal-error':
        this.renderFatal(state);
        break;
    }
  }

  private renderLoading(message: string): void {
    this.elements.screenHost.innerHTML = `
      <section class="screen" data-testid="loading-screen" aria-busy="true">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p class="status-message">${escapeHtml(message)}</p>
      </section>`;
    this.setOpeningBackground();
  }

  private renderOpening(state: Extract<AppState, { kind: 'opening' }>): void {
    const audioWarning = renderAudioWarning(state.audio.state);
    this.elements.screenHost.innerHTML = `
      <section class="screen opening-screen" data-testid="opening-screen">
        <p class="opening-kicker">The recovered browser edition</p>
        <div class="title-lockup">
          <h1 class="game-title">Preston <span>vs</span> Particles</h1>
          <p class="opening-tagline">BGM: David So HandSome</p>
        </div>
        <div class="opening-actions">
          <button class="primary-button" type="button" data-action="start" data-testid="start-game">Start Shooting!</button>
          ${audioWarning}
          <button class="secondary-button" type="button" data-action="mute" aria-pressed="${String(state.audio.muted)}">
            ${state.audio.muted ? 'Turn sound on' : 'Mute sound'}
          </button>
          <p class="sound-status">Sound starts after your click, as required by the browser.</p>
        </div>
      </section>`;
    this.setOpeningBackground();
  }

  private renderGate(state: Extract<AppState, { kind: 'gate' }>): void {
    const { gate } = state;
    if (gate.step === 'question-1') {
      this.elements.screenHost.innerHTML = `
        <section class="screen" data-testid="question-1">
          <div class="card">
            <p class="eyebrow">Question 1 of 2</p>
            <h1>Important question</h1>
            <p class="question-text">Is David handsome?</p>
            <button class="choice-button" type="button" data-action="q1-yes" data-testid="q1-yes">Yes</button>
          </div>
        </section>`;
    } else if (gate.step === 'question-2') {
      this.elements.screenHost.innerHTML = `
        <section class="screen" data-testid="question-2">
          <div class="card">
            <p class="eyebrow">Question 2 of 2</p>
            <h1>Think carefully</h1>
            <p class="question-text">Is David handsome?</p>
            <div class="button-row">
              <button class="choice-button" type="button" data-action="q2-yes" data-testid="q2-yes">Yes</button>
              <button class="choice-button no-button" type="button" data-action="q2-no" data-testid="q2-no">No</button>
            </div>
          </div>
        </section>`;
    } else if (gate.step === 'secret-code') {
      this.elements.screenHost.innerHTML = `
        <section class="screen" data-testid="secret-code-screen">
          <div class="card">
            <p class="eyebrow">Final clearance</p>
            <h1>Secret code</h1>
            <p class="question-text">Enter the code to unlock the arena.</p>
            <form class="code-form" data-form="secret-code">
              <label for="secret-code">Code</label>
              <input class="text-input" id="secret-code" name="code" type="text" autocomplete="off" spellcheck="false" data-testid="secret-code-input" autofocus>
              ${gate.error ? '<p class="error-message" role="alert">Incorrect code. Capitalization matters.</p>' : ''}
              <button class="primary-button" type="submit" data-testid="secret-code-submit">Unlock</button>
            </form>
          </div>
        </section>`;
    } else {
      this.renderLoading('Preparing character setup…');
      return;
    }
    this.setOpeningBackground();
  }

  private renderRejected(_state: Extract<AppState, { kind: 'rejected' }>): void {
    this.elements.screenHost.innerHTML = `
      <section class="screen rejected-screen" data-testid="rejected-screen">
        <div class="card">
          <div class="rejected-mark" aria-hidden="true">⛔</div>
          <h1 class="access-denied">Access denied</h1>
          <p class="question-text">That answer cannot enter the arena. Gameplay was not initialized.</p>
          <button class="secondary-button" type="button" data-action="return-opening" data-testid="rejected-return">Return to main menu</button>
        </div>
      </section>`;
    this.setOpeningBackground();
  }

  private renderCustomizer(state: Extract<AppState, { kind: 'customizing' }>): void {
    const { customization } = state;
    const playerAssets = customization.assets.filter((asset) => asset.role === 'player');
    const enemyAssets = customization.assets.filter((asset) => asset.role === 'enemy');
    const customEnemiesSelected = customization.selection.enemies.some((ref) => ref.kind === 'local-upload');
    this.elements.screenHost.innerHTML = `
      <section class="screen customizer-screen" data-testid="customization-screen">
        <header class="customizer-header">
          <p class="eyebrow">Arena loadout</p>
          <h1>Choose characters</h1>
          <p class="privacy-note">Uploads stay in this browser. Images are normalized to 512×512; hitboxes never change.</p>
        </header>
        ${state.error ? `<p class="error-message" role="alert">${escapeHtml(state.error)}</p>` : ''}
        ${state.message ? `<p class="status-message" role="status">${escapeHtml(state.message)}</p>` : ''}
        ${customization.warning ? `<p class="sound-warning" role="status">Saved browser storage is unavailable; this session will use memory.</p>` : ''}
        <div class="customizer-grid">
          <section class="customizer-section" aria-labelledby="player-heading">
            <h2 id="player-heading">Player</h2>
            <div class="preview-row">
              ${this.renderPlayerChoice({ kind: 'packaged', assetKey: 'player.default' }, customization, 'Original player')}
              ${playerAssets.map((asset) => this.renderPlayerAsset(asset, customization)).join('')}
            </div>
            <label class="upload-button">
              Upload custom player
              <input type="file" accept="image/png,image/jpeg,image/webp" data-upload-role="player" data-testid="upload-player">
            </label>
            <p class="help-text">PNG, JPEG, or WebP; maximum 10 MB. Minimum 128×128.</p>
          </section>
          <section class="customizer-section" aria-labelledby="enemy-heading">
            <h2 id="enemy-heading">Enemies</h2>
            <div class="button-row">
              <button class="secondary-button" type="button" data-action="default-enemies" aria-pressed="${String(!customEnemiesSelected)}" data-testid="default-enemies">Use original four</button>
            </div>
            <div class="enemy-roster" aria-label="Custom enemy roster">
              ${enemyAssets.length === 0 ? '<p class="help-text">Upload one or more enemy images to build a custom roster.</p>' : enemyAssets.map((asset) => this.renderEnemyAsset(asset, customization)).join('')}
            </div>
            <label class="upload-button">
              Upload custom enemy
              <input type="file" accept="image/png,image/jpeg,image/webp" data-upload-role="enemy" data-testid="upload-enemy" multiple ${enemyAssets.length >= 8 ? 'disabled' : ''}>
            </label>
            <p class="help-text">Select up to 8 custom enemies. Each spawn draws from the selected roster.</p>
          </section>
          ${this.renderCropEditor()}
        </div>
        <div class="customizer-actions">
          <button class="secondary-button" type="button" data-action="main-menu">Main menu</button>
          <button class="primary-button" type="button" data-action="enter-arena" data-testid="enter-arena" ${customization.selection.enemies.length === 0 ? 'disabled' : ''}>Enter arena</button>
          <button class="danger-button" type="button" data-action="clear-customizations">Reset custom images</button>
          <button class="secondary-button" type="button" data-action="mute" aria-pressed="${String(state.audio.muted)}">${state.audio.muted ? 'Sound on' : 'Mute'}</button>
        </div>
      </section>`;
    this.setOpeningBackground();
  }

  private renderPlayerChoice(
    ref: CharacterSkinRef,
    customization: CustomizationSnapshot,
    label: string,
  ): string {
    const selected = sameRef(ref, customization.selection.player);
    const url = this.controller.skinUrl(ref) ?? this.controller.assetUrl('player.default');
    const identity = encodeRef(ref);
    return `
      <button class="skin-preview ${selected ? 'selected' : ''}" type="button" data-action="select-player" data-ref="${escapeAttr(identity)}" aria-label="${escapeAttr(label)}" aria-pressed="${String(selected)}">
        <img src="${escapeAttr(url)}" alt="">
      </button>`;
  }

  private renderPlayerAsset(asset: CustomAssetRecord, customization: CustomizationSnapshot): string {
    const ref: CharacterSkinRef = { kind: 'local-upload', id: asset.id, revision: asset.revision };
    const choice = this.renderPlayerChoice(ref, customization, 'Use uploaded player');
    return `<div>${choice}<button class="danger-button" type="button" data-action="delete-upload" data-id="${escapeAttr(asset.id)}" aria-label="Delete uploaded player">Delete</button></div>`;
  }

  private renderEnemyAsset(asset: CustomAssetRecord, customization: CustomizationSnapshot): string {
    const ref: CharacterSkinRef = { kind: 'local-upload', id: asset.id, revision: asset.revision };
    const selected = customization.selection.enemies.some((candidate) => sameRef(candidate, ref));
    const url = this.controller.skinUrl(ref) ?? '';
    return `
      <div>
        <label class="skin-preview ${selected ? 'selected' : ''}" aria-label="Include uploaded enemy">
          <img src="${escapeAttr(url)}" alt="">
          <input type="checkbox" data-enemy-ref="${escapeAttr(encodeRef(ref))}" ${selected ? 'checked' : ''}>
        </label>
        <button class="danger-button" type="button" data-action="delete-upload" data-id="${escapeAttr(asset.id)}" aria-label="Delete uploaded enemy">Delete</button>
      </div>`;
  }

  private renderCropEditor(): string {
    const pending = this.pendingUpload;
    if (!pending) return '';
    const panX = `${pending.crop.panX * 20}%`;
    const panY = `${pending.crop.panY * 20}%`;
    return `
      <section class="customizer-section crop-editor" aria-labelledby="crop-heading" data-testid="crop-editor">
        <h2 id="crop-heading">Crop ${pending.role}</h2>
        <div class="crop-preview"><img src="${escapeAttr(pending.previewUrl)}" alt="Upload crop preview" style="--pan-x:${panX};--pan-y:${panY};--zoom:${pending.crop.zoom}"></div>
        ${renderRange('Horizontal', 'panX', -1, 1, 0.05, pending.crop.panX)}
        ${renderRange('Vertical', 'panY', -1, 1, 0.05, pending.crop.panY)}
        ${renderRange('Zoom', 'zoom', 1, 3, 0.05, pending.crop.zoom)}
        <div class="button-row">
          <button class="secondary-button" type="button" data-action="cancel-upload">Cancel</button>
          <button class="primary-button" type="button" data-action="save-upload" data-testid="save-upload" ${this.savingUpload ? 'disabled' : ''}>${this.savingUpload ? 'Saving…' : 'Save image'}</button>
        </div>
      </section>`;
  }

  private renderGameHud(state: Extract<AppState, { kind: 'playing' | 'paused' | 'game-over' }>): void {
    const healthPercent = Math.max(0, Math.min(100, (state.game.player.health / state.game.player.maxHealth) * 100));
    const audio = state.audio;
    let overlay = '';
    if (state.kind === 'paused') {
      overlay = `
        <div class="game-overlay" data-testid="pause-overlay">
          <div class="pause-card">
            <p class="eyebrow">${state.source === 'visibility' ? 'Game paused while away' : 'Take a breath'}</p>
            <h1>Paused</h1>
            <button class="primary-button" type="button" data-action="resume" data-testid="resume-game">Resume</button>
            <button class="secondary-button" type="button" data-action="main-menu">Main menu</button>
          </div>
        </div>`;
    } else if (state.kind === 'game-over') {
      overlay = `
        <div class="game-overlay" data-testid="game-over-screen">
          <div class="game-over-card">
            <p class="eyebrow">The swarm got through</p>
            <h1>GAME OVER</h1>
            <div class="result-grid">
              ${renderResult(state.result.finalScore, 'Final Score')}
            </div>
            <div class="button-row">
              <button class="primary-button" type="button" data-action="retry" data-testid="retry-game">Shooting Again!</button>
              <button class="secondary-button" type="button" data-action="change-characters" data-testid="change-characters">Change characters</button>
              <button class="secondary-button" type="button" data-action="main-menu" data-testid="gameover-main-menu">Main menu</button>
            </div>
          </div>
        </div>`;
    }

    this.elements.hudHost.innerHTML = `
      <div class="hud" data-testid="game-hud" data-health="${state.game.player.health}" data-score="${state.game.score}">
        <div class="hud-cluster">
          <div class="hud-pill" data-testid="hud-health">HP ${Math.ceil(state.game.player.health)}</div>
          <div class="health-meter" role="meter" aria-label="Player health" aria-valuemin="0" aria-valuemax="${state.game.player.maxHealth}" aria-valuenow="${state.game.player.health}"><span style="--health:${healthPercent}%"></span></div>
          <div class="hud-pill" data-testid="hud-score">Score ${state.game.score}</div>
        </div>
        <div class="hud-actions">
          ${state.kind === 'playing' ? '<button class="icon-button" type="button" data-action="pause" aria-label="Pause game" data-testid="pause-game">Ⅱ</button>' : ''}
          <button class="icon-button" type="button" data-action="mute" aria-label="${audio.muted ? 'Turn sound on' : 'Mute sound'}" aria-pressed="${String(audio.muted)}">${audio.muted ? '🔇' : '🔊'}</button>
        </div>
      </div>
      <p class="control-hint">WASD / arrows to move · Space fires one shot · touch joystick + FIRE</p>
      ${overlay}`;
  }

  /** Keep gameplay controls mounted while 60 Hz state is published. */
  private updateGameHud(state: Extract<AppState, { kind: 'playing' | 'paused' | 'game-over' }>): void {
    const host = this.elements.hudHost;
    const health = state.game.player.health;
    const healthPercent = Math.max(0, Math.min(100, (health / state.game.player.maxHealth) * 100));
    const hud = host.querySelector<HTMLElement>('[data-testid="game-hud"]');
    if (hud) {
      hud.dataset.health = String(health);
      hud.dataset.score = String(state.game.score);
    }
    const healthText = host.querySelector<HTMLElement>('[data-testid="hud-health"]');
    if (healthText) healthText.textContent = `HP ${Math.ceil(health)}`;
    const scoreText = host.querySelector<HTMLElement>('[data-testid="hud-score"]');
    if (scoreText) scoreText.textContent = `Score ${state.game.score}`;
    const meter = host.querySelector<HTMLElement>('.health-meter');
    meter?.setAttribute('aria-valuenow', String(health));
    const meterFill = host.querySelector<HTMLElement>('.health-meter span');
    meterFill?.style.setProperty('--health', `${healthPercent}%`);
    const mute = host.querySelector<HTMLButtonElement>('[data-action="mute"]');
    if (mute) {
      mute.setAttribute('aria-label', state.audio.muted ? 'Turn sound on' : 'Mute sound');
      mute.setAttribute('aria-pressed', String(state.audio.muted));
      mute.textContent = state.audio.muted ? '🔇' : '🔊';
    }
  }

  private renderFatal(state: Extract<AppState, { kind: 'fatal-error' }>): void {
    this.elements.screenHost.innerHTML = `
      <section class="screen" data-testid="fatal-error">
        <div class="card">
          <p class="eyebrow">Unable to start</p>
          <h1>Something broke</h1>
          <p class="error-message" role="alert">${escapeHtml(state.failure.message)}</p>
          <button class="secondary-button" type="button" data-action="reload">Reload game</button>
        </div>
      </section>`;
    this.setOpeningBackground(false);
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    switch (action) {
      case 'start':
        this.dispatch({ type: 'START_PRESSED' });
        break;
      case 'audio-retry':
        this.dispatch({ type: 'AUDIO_RETRY' });
        break;
      case 'mute':
        this.dispatch({ type: 'MUTE_CHANGED', muted: !this.audioMuted() });
        break;
      case 'q1-yes':
        this.dispatch({ type: 'GATE_ACTION', action: { type: 'ANSWER_Q1_YES' } });
        break;
      case 'q2-yes':
        this.dispatch({ type: 'GATE_ACTION', action: { type: 'ANSWER_Q2', answer: 'yes' } });
        break;
      case 'q2-no':
        this.dispatch({ type: 'GATE_ACTION', action: { type: 'ANSWER_Q2', answer: 'no' } });
        break;
      case 'return-opening':
        this.dispatch({ type: 'RETURN_TO_OPENING' });
        break;
      case 'select-player': {
        const ref = decodeRef(target.dataset.ref);
        if (ref?.kind === 'packaged') this.dispatch({ type: 'SELECT_DEFAULT_PLAYER' });
        else if (ref) this.dispatch({ type: 'SELECT_CUSTOM_PLAYER', ref });
        break;
      }
      case 'default-enemies':
        this.dispatch({ type: 'SELECT_DEFAULT_ENEMIES' });
        break;
      case 'delete-upload':
        if (target.dataset.id) this.dispatch({ type: 'DELETE_UPLOAD', id: target.dataset.id });
        break;
      case 'clear-customizations':
        this.dispatch({ type: 'CLEAR_CUSTOMIZATIONS' });
        break;
      case 'cancel-upload':
        this.clearPendingUpload();
        this.render(this.latestState);
        break;
      case 'save-upload':
        this.savePendingUpload();
        break;
      case 'enter-arena':
        this.dispatch({ type: 'ENTER_ARENA' });
        break;
      case 'pause':
        this.dispatch({ type: 'PAUSE_REQUESTED', source: 'user' });
        break;
      case 'resume':
        this.dispatch({ type: 'RESUME_REQUESTED' });
        break;
      case 'retry':
        this.dispatch({ type: 'RETRY_REQUESTED' });
        break;
      case 'change-characters':
        this.dispatch({ type: 'CHANGE_CHARACTERS_REQUESTED' });
        break;
      case 'main-menu':
        this.dispatch({ type: 'MAIN_MENU_REQUESTED' });
        break;
      case 'reload':
        window.location.reload();
        break;
    }
  };

  private readonly handleSubmit = (event: Event): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.form !== 'secret-code') return;
    event.preventDefault();
    const formData = new FormData(form);
    const value = formData.get('code');
    this.dispatch({
      type: 'GATE_ACTION',
      action: { type: 'SUBMIT_CODE', value: typeof value === 'string' ? value : '' },
    });
  };

  private readonly handleChange = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file' && target.dataset.uploadRole) {
      const files = [...(target.files ?? [])];
      if (files.length > 0) this.setPendingUploads(target.dataset.uploadRole === 'enemy' ? 'enemy' : 'player', files);
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'checkbox' && target.dataset.enemyRef) {
      const ref = decodeRef(target.dataset.enemyRef);
      if (!ref || ref.kind !== 'local-upload' || this.latestState.kind !== 'customizing') return;
      const selected = this.latestState.customization.selection.enemies.filter((item) => item.kind === 'local-upload');
      const next = target.checked
        ? [...selected.filter((item) => !sameRef(item, ref)), ref]
        : selected.filter((item) => !sameRef(item, ref));
      if (next.length === 0) {
        target.checked = true;
        return;
      }
      this.dispatch({ type: 'SELECT_CUSTOM_ENEMIES', refs: next });
    }
  };

  private readonly handleInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.crop || !this.pendingUpload) return;
    const value = Number(target.value);
    if (!Number.isFinite(value)) return;
    this.pendingUpload.crop = { ...this.pendingUpload.crop, [target.dataset.crop]: value };
    const image = this.elements.screenHost.querySelector<HTMLElement>('.crop-preview img');
    if (image) {
      image.style.setProperty('--pan-x', `${this.pendingUpload.crop.panX * 20}%`);
      image.style.setProperty('--pan-y', `${this.pendingUpload.crop.panY * 20}%`);
      image.style.setProperty('--zoom', String(this.pendingUpload.crop.zoom));
    }
  };

  private setPendingUploads(role: 'player' | 'enemy', files: readonly File[]): void {
    this.clearPendingUpload();
    const existingEnemies = this.latestState.kind === 'customizing'
      ? this.latestState.customization.assets.filter((asset) => asset.role === 'enemy').length
      : 0;
    const accepted = role === 'enemy' ? files.slice(0, Math.max(0, 8 - existingEnemies)) : files.slice(0, 1);
    const [file, ...queued] = accepted;
    if (!file) return;
    this.uploadQueue = queued;
    this.pendingUpload = {
      role,
      file,
      previewUrl: URL.createObjectURL(file),
      crop: { panX: 0, panY: 0, zoom: 1 },
    };
    this.render(this.latestState);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const editor = this.elements.screenHost.querySelector<HTMLElement>('[data-testid="crop-editor"]');
        editor?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  private async savePendingUpload(): Promise<void> {
    const pending = this.pendingUpload;
    if (!pending || this.savingUpload) return;
    this.savingUpload = true;
    this.render(this.latestState);
    const command: AppCommand = {
      type: 'PROCESS_UPLOAD',
      target: pending.role,
      file: pending.file,
      crop: pending.crop,
    };
    try {
      const result = await this.controller.dispatch(command);
      if (result.ok) this.advancePendingUpload();
    } catch {
      this.showDispatchFailure();
    } finally {
      this.savingUpload = false;
      this.render(this.latestState);
    }
  }

  private advancePendingUpload(): void {
    const role = this.pendingUpload?.role;
    if (this.pendingUpload) URL.revokeObjectURL(this.pendingUpload.previewUrl);
    this.pendingUpload = undefined;
    const next = this.uploadQueue.shift();
    if (role && next) {
      this.pendingUpload = {
        role,
        file: next,
        previewUrl: URL.createObjectURL(next),
        crop: { panX: 0, panY: 0, zoom: 1 },
      };
    }
  }

  private clearPendingUpload(): void {
    if (this.pendingUpload) URL.revokeObjectURL(this.pendingUpload.previewUrl);
    this.pendingUpload = undefined;
    this.uploadQueue = [];
  }

  private audioMuted(): boolean {
    const state = this.latestState;
    return 'audio' in state && state.audio ? state.audio.muted : false;
  }

  private dispatch(command: AppCommand): void {
    void this.controller.dispatch(command).catch(() => this.showDispatchFailure());
  }

  private showDispatchFailure(): void {
    const existing = this.elements.screenHost.querySelector('[data-presenter-error]');
    if (existing) return;
    const message = document.createElement('p');
    message.className = 'error-message';
    message.dataset.presenterError = 'true';
    message.setAttribute('role', 'alert');
    message.textContent = 'That action could not be completed. Please try again.';
    this.elements.screenHost.querySelector('.screen')?.prepend(message);
  }

  private setOpeningBackground(useCatalog = true): void {
    const screen = this.elements.screenHost.querySelector<HTMLElement>('.screen');
    if (!screen || !useCatalog) return;
    try {
      screen.style.setProperty(
        '--screen-bg',
        `url("${this.controller.assetUrl('background.openingMirrorSupertile')}"), url("${this.controller.assetUrl('background.openingFixed')}")`,
      );
      screen.style.setProperty('--screen-bg-size', '20% 20%, cover');
      screen.style.setProperty('--screen-bg-repeat', 'repeat, no-repeat');
    } catch {
      // A boot failure still needs a readable DOM error surface.
    }
  }
}

function renderAudioWarning(state: string): string {
  if (state !== 'blocked' && state !== 'failed') return '';
  return `<div class="sound-warning" role="status">Sound could not start. The game remains playable.<br><button class="secondary-button" type="button" data-action="audio-retry">Enable sound</button></div>`;
}

function renderRange(label: string, key: keyof CropSettings, min: number, max: number, step: number, value: number): string {
  return `<label class="range-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-crop="${key}"></label>`;
}

function renderResult(value: string | number, label: string): string {
  return `<div class="result-stat"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function sameRef(left: CharacterSkinRef, right: CharacterSkinRef): boolean {
  return left.kind === right.kind && (
    left.kind === 'packaged' && right.kind === 'packaged'
      ? left.assetKey === right.assetKey
      : left.kind === 'local-upload' && right.kind === 'local-upload' && left.id === right.id && left.revision === right.revision
  );
}

function encodeRef(ref: CharacterSkinRef): string {
  return ref.kind === 'packaged'
    ? `packaged:${ref.assetKey}`
    : `local:${encodeURIComponent(ref.id)}:${ref.revision}`;
}

function decodeRef(value: string | undefined): CharacterSkinRef | undefined {
  if (!value) return undefined;
  if (value === 'packaged:player.default') return { kind: 'packaged', assetKey: 'player.default' };
  const match = /^local:(.*):(\d+)$/.exec(value);
  if (!match?.[1] || !match[2]) return undefined;
  const revision = Number(match[2]);
  if (!Number.isSafeInteger(revision) || revision < 1) return undefined;
  try {
    return { kind: 'local-upload', id: decodeURIComponent(match[1]), revision };
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

const escapeAttr = escapeHtml;
