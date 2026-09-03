/** Keeps Blob URLs bounded and revokes every URL it creates. */
export class ObjectUrlRegistry {
  private readonly urls = new Map<string, string>();

  public get(key: string, blob: Blob): string {
    const existing = this.urls.get(key);
    if (existing) return existing;
    const url = URL.createObjectURL(blob);
    this.urls.set(key, url);
    return url;
  }

  public retain(keys: ReadonlySet<string>): void {
    for (const [key, url] of this.urls) {
      if (keys.has(key)) continue;
      URL.revokeObjectURL(url);
      this.urls.delete(key);
    }
  }

  public clear(): void {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }

  public get size(): number {
    return this.urls.size;
  }
}
