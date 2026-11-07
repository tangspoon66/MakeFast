import { beforeEach, describe, expect, it } from 'vitest';
import { captureLegacyDraft, clearLegacyDraft, getLegacyDraft } from './legacyDraft';

describe('legacy draft import boundary', () => {
  beforeEach(() => localStorage.clear());

  it('copies a recent local draft without uploading or exposing it to another account', () => {
    localStorage.setItem('editor-store-v2', JSON.stringify({ state: {
      code: 'void setup() {}',
      projectFiles: [{ id: 'main', name: 'main.ino', content: 'void setup() {}' }],
      selectedBoard: 'esp32s3',
      savedAt: Date.now(),
    } }));

    expect(captureLegacyDraft('learner-1')?.code).toBe('void setup() {}');
    expect(getLegacyDraft('learner-2')).toBeNull();
    expect(captureLegacyDraft('learner-2')).toBeNull();
    expect(localStorage.getItem('editor-store-v2')).not.toBeNull();

    clearLegacyDraft('learner-2');
    expect(getLegacyDraft('learner-1')).not.toBeNull();
    clearLegacyDraft('learner-1');
    expect(getLegacyDraft('learner-1')).toBeNull();
  });

  it('does not offer expired or empty editor state', () => {
    localStorage.setItem('editor-store-v2', JSON.stringify({ state: {
      code: 'void setup() {}', projectFiles: [], savedAt: Date.now() - 25 * 60 * 60 * 1000,
    } }));
    expect(captureLegacyDraft('learner-1')).toBeNull();
  });
});
