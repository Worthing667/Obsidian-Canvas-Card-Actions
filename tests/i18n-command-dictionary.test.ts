import * as assert from "node:assert/strict";
import { t } from "../src/i18n";

const enSettings = { language: "en" } as const;
const zhSettings = { language: "zh-CN" } as const;

function testCommandMenuAndNoticeKeysResolveInEnglish() {
  assert.equal(t("commands.quickCopySelectedCards" as any, undefined, { settings: enSettings }), "Quick copy current selection");
  assert.equal(t("menu.splitCard" as any, undefined, { settings: enSettings }), "Split card...");
  assert.equal(
    t("notice.sameColorCardsSelected" as any, { count: 3 }, { settings: enSettings }),
    "Selected 3 cards with matching colors"
  );
}

function testCommandMenuAndNoticeKeysResolveInChinese() {
  assert.equal(t("commands.quickCopySelectedCards" as any, undefined, { settings: zhSettings }), "将当前选区一键复制");
  assert.equal(t("menu.splitCard" as any, undefined, { settings: zhSettings }), "拆分卡片...");
  assert.equal(
    t("notice.sameColorCardsSelected" as any, { count: 3 }, { settings: zhSettings }),
    "已选中 3 张匹配颜色的卡片"
  );
}

void (() => {
  testCommandMenuAndNoticeKeysResolveInEnglish();
  testCommandMenuAndNoticeKeysResolveInChinese();
  console.log("i18n command dictionary tests passed");
})();
