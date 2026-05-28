import * as assert from "node:assert/strict";
import {
  clearTranslationRuntimeContext,
  configureTranslationRuntimeContext,
  getCurrentLanguage,
  normalizeLanguageSetting,
  resolveLanguage,
  t
} from "../src/i18n";

const enSettings = { language: "en" } as const;
const zhSettings = { language: "zh-CN" } as const;

function testCommandMenuAndNoticeKeysResolveInEnglish() {
  assert.equal(t("commands.quickCopySelectedCards", undefined, { settings: enSettings }), "Quick copy current selection");
  assert.equal(t("menu.splitCard", undefined, { settings: enSettings }), "Split card...");
  assert.equal(
    t("notice.sameColorCardsSelected", { count: 3 }, { settings: enSettings }),
    "Selected 3 cards with matching colors"
  );
}

function testCommandMenuAndNoticeKeysResolveInChinese() {
  assert.equal(t("commands.quickCopySelectedCards", undefined, { settings: zhSettings }), "将当前选区一键复制");
  assert.equal(t("menu.splitCard", undefined, { settings: zhSettings }), "拆分卡片...");
  assert.equal(
    t("notice.sameColorCardsSelected", { count: 3 }, { settings: zhSettings }),
    "已选中 3 张匹配颜色的卡片"
  );
}

function testBareTranslateUsesRuntimeContext() {
  configureTranslationRuntimeContext({ getSettings: () => zhSettings });
  assert.equal(t("menu.splitCard"), "拆分卡片...");

  configureTranslationRuntimeContext({ getSettings: () => enSettings });
  assert.equal(t("menu.splitCard"), "Split card...");

  clearTranslationRuntimeContext();
}

function testNormalizeLanguageSettingFallsBackToAuto() {
  assert.equal(normalizeLanguageSetting("en"), "en");
  assert.equal(normalizeLanguageSetting("zh-CN"), "zh-CN");
  assert.equal(normalizeLanguageSetting("auto"), "auto");
  assert.equal(normalizeLanguageSetting("zh-cn"), "auto");
  assert.equal(normalizeLanguageSetting(null), "auto");
}

function testResolveLanguageUsesExplicitSettingBeforeEnvironment() {
  const zhApp = {
    vault: {
      getConfig: () => "zh-TW"
    }
  };

  assert.equal(resolveLanguage("en", zhApp as never), "en");
  assert.equal(resolveLanguage("zh-CN"), "zh-CN");
}

function testResolveLanguageReadsObsidianLanguageForAuto() {
  const zhApp = {
    vault: {
      getConfig: () => "zh_Hans"
    }
  };
  const enApp = {
    vault: {
      getConfig: () => "fr"
    }
  };

  assert.equal(resolveLanguage("auto", zhApp as never), "zh-CN");
  assert.equal(resolveLanguage("auto", enApp as never), "en");
}

function testGetCurrentLanguageUsesSettings() {
  assert.equal(getCurrentLanguage(enSettings), "en");
  assert.equal(getCurrentLanguage(zhSettings), "zh-CN");
}

void (() => {
  testCommandMenuAndNoticeKeysResolveInEnglish();
  testCommandMenuAndNoticeKeysResolveInChinese();
  testBareTranslateUsesRuntimeContext();
  testNormalizeLanguageSettingFallsBackToAuto();
  testResolveLanguageUsesExplicitSettingBeforeEnvironment();
  testResolveLanguageReadsObsidianLanguageForAuto();
  testGetCurrentLanguageUsesSettings();
  console.log("i18n command dictionary tests passed");
})();
