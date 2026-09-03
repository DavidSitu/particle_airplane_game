export interface BrowserLifecycleCallbacks {
  readonly onHidden: () => void;
  readonly onVisible: () => void;
  readonly onBlur: () => void;
  readonly onFocus: () => void;
  readonly onPageHide: () => void;
}

/** Owns the browser lifecycle listeners used by the composition root. */
export class BrowserLifecycleAdapter {
  private mounted = false;

  public constructor(private readonly callbacks: BrowserLifecycleCallbacks) {}

  public mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('pagehide', this.handlePageHide);
  }

  public dispose(): void {
    if (!this.mounted) return;
    this.mounted = false;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('pagehide', this.handlePageHide);
  }

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.callbacks.onHidden();
    else this.callbacks.onVisible();
  };

  private readonly handlePageHide = (): void => {
    this.callbacks.onPageHide();
  };

  private readonly handleBlur = (): void => {
    this.callbacks.onBlur();
  };

  private readonly handleFocus = (): void => {
    this.callbacks.onFocus();
  };
}
