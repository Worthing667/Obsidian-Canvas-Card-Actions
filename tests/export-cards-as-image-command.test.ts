import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import type { CanvasNode } from "../src/types/canvas";

const moduleLoader = require("node:module") as {
  _resolveFilename(
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ): string;
};
const resolveFilename = moduleLoader._resolveFilename;

moduleLoader._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
): string {
  if (request === "obsidian") {
    return resolve("tests/stubs/obsidian.ts");
  }

  return resolveFilename.call(this, request, parent, isMain, options);
};

function createTextNode(id: string): CanvasNode {
  return {
    id,
    getData: () => ({
      id,
      type: "text",
      text: id,
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    }),
  };
}

test("图片导出命令仅对 Canvas 文本卡片启用并提示保存位置", async () => {
  const { Notice } = await import("./stubs/obsidian");
  const { ExportCardsAsImageCommand } = await import(
    "../src/presentation/commands/ExportCardsAsImageCommand"
  );
  Notice.messages = [];
  const selection = [createTextNode("a"), createTextNode("b")];
  let exportedSelection: CanvasNode[] = [];
  const service = {
    async exportSelection(nodes: CanvasNode[]) {
      exportedSelection = nodes;
      return {
        file: { path: "folder/Board-selection-2.png" },
        nodeCount: 2,
        pixelRatio: 2,
      };
    },
  };
  const command = new ExportCardsAsImageCommand(
    service as never,
    selection,
    { extension: "canvas" } as never,
    { language: "zh-CN" },
  );

  assert.equal(command.canExecute(), true);
  await command.execute();

  assert.equal(exportedSelection, selection);
  assert.deepEqual(Notice.messages, [
    "已将 2 张卡片导出为图片：folder/Board-selection-2.png",
  ]);
});
