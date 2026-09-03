import {
  assertCustomizationRecord,
  cloneCustomizationRecord,
  CustomizationError,
  type CharacterStorePort,
  type CustomizationRecord,
} from '../../systems/customization/contracts';

export class MemoryCharacterStore implements CharacterStorePort {
  private record: CustomizationRecord | null = null;

  async load(): Promise<CustomizationRecord | null> {
    return this.record === null ? null : cloneCustomizationRecord(this.record);
  }

  async save(record: CustomizationRecord): Promise<void> {
    assertCustomizationRecord(record);
    if (this.record !== null && this.record.revision > record.revision) {
      throw new CustomizationError('stale-write');
    }
    this.record = cloneCustomizationRecord(record);
  }

  async clear(): Promise<void> {
    this.record = null;
  }
}
