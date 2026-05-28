import * as assert from 'node:assert/strict';
import { CanvasSelectionToolbarService } from '../src/services/CanvasSelectionToolbarService';
import { t } from '../src/i18n';

function createService() {
  return new CanvasSelectionToolbarService({} as never, () => ({ language: 'zh-CN' }));
}

function testInvalidCardSizeMessageMatchesChineseTranslation() {
  const service = createService() as unknown as {
    isInvalidCardSizeMessage: (message: string) => boolean;
  };
  const message = t('errors.invalidCardSize', {
    width: 0,
    height: 50,
  }, {
    settings: { language: 'zh-CN' },
  });

  assert.equal(service.isInvalidCardSizeMessage(message), true);
}

void (() => {
  testInvalidCardSizeMessageMatchesChineseTranslation();
  console.log('canvas selection toolbar i18n tests passed');
})();
