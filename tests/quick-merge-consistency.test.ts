import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import type CanvasLoomSettings from "../src/settings/ICanvasLoomSettings";
import type { CanvasNode } from "../src/types/canvas";

const moduleLoader = require("node:module") as {
  _resolveFilename(
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown
  ): string;
};
const resolveFilename = moduleLoader._resolveFilename;

moduleLoader._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown
): string {
  if (request === "obsidian") {
    return resolve("tests/stubs/obsidian.ts");
  }

  return resolveFilename.call(this, request, parent, isMain, options);
};

function settings(defaultSortMode: "position" | "badge"): CanvasLoomSettings {
  return {
    canvasCardDelimiter: "---",
    insertDelimiterOnMerge: false,
    splitCardsPerRow: 5,
    sortPriority: "yx",
    enableBadges: true,
    showEdgesAboveCards: false,
    canvasLabelZoomCompensation: 100,
    defaultSortMode,
    mergeCleanupMode: "keep-source",
    enablePerformanceMode: false,
    enablePerformanceDiagnostics: false,
    largeCanvasNodeThreshold: 80,
    badgeUpdateDebounceMs: 150,
    enableZoomControl: true,
  };
}

void (async () => {
  const { ContentService } = await import("../src/services/ContentService");
  const { MergeService } = await import("../src/services/MergeService");
  const { QuickMergeCommand } = await import("../src/presentation/commands/QuickActionCommands");
  const { t } = await import("../src/i18n");

  async function executeQuickMerge(defaultSortMode: "position" | "badge"): Promise<string> {
    let mergedText = "";
    const canvasData = { nodes: [] as Array<{ text?: string }>, edges: [] };
    const canvasAdapter = {
      mutateData: async (mutation: (data: typeof canvasData) => void) => {
        mutation(canvasData);
        mergedText = canvasData.nodes[canvasData.nodes.length - 1]?.text || "";
      },
      requestSave: async () => undefined,
    };
    const node = {
      id: "card",
      getData: () => ({
        id: "card",
        type: "text",
        text: "card content",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        badge: "1",
      }),
    } as CanvasNode;
    const contentService = new ContentService(
      canvasAdapter as never,
      {} as never,
      { getCurrentBadge: async () => undefined } as never
    );
    const mergeService = new MergeService(
      {} as never,
      canvasAdapter as never,
      contentService,
      {} as never
    );
    const command = new QuickMergeCommand(mergeService, [node], settings(defaultSortMode));

    await command.execute();
    return mergedText;
  }

  test("位置排序的一键拼合不输出标记前缀", async () => {
    assert.equal(await executeQuickMerge("position"), "card content");
  });

  test("序号排序的一键拼合不输出标记前缀", async () => {
    assert.equal(await executeQuickMerge("badge"), "card content");
  });

  test("工作台新卡片按钮明确表达拼合动作", () => {
    assert.equal(
      t("workbench.button.addAsCard", undefined, { settings: { language: "zh-CN" } }),
      "拼合为新卡片"
    );
    assert.equal(
      t("workbench.button.addAsCard", undefined, { settings: { language: "en" } }),
      "Merge into new card"
    );
  });

  test("原标记排序入口显示为统一的序号排序", () => {
    assert.equal(
      t("workbench.sortMode.badge", undefined, { settings: { language: "zh-CN" } }),
      "序号"
    );
    assert.equal(
      t("workbench.sortMode.badge", undefined, { settings: { language: "en" } }),
      "Number"
    );
    assert.equal(
      t("settings.defaultSortMode.option.badge", undefined, { settings: { language: "zh-CN" } }),
      "按序号顺序"
    );
  });
})();
