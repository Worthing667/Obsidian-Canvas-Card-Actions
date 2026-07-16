import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import type { WorkbenchState } from "../src/types/WorkbenchState";

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

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

test("工作台图片渲染器允许 html-to-image 过滤文本节点", async () => {
  const { HtmlToImageWorkbenchRenderer } = await import(
    "../src/services/WorkbenchImageExportService"
  );
  const previewElement = {
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({
          backgroundColor: "#ffffff",
        }),
      },
    },
  } as unknown as HTMLElement;
  const renderer = new HtmlToImageWorkbenchRenderer(async (_node, options) => {
    const textNode = { nodeType: 3 } as unknown as HTMLElement;
    assert.doesNotThrow(() => options.filter?.(textNode));
    return new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  });

  const imageData = await renderer.render(previewElement);

  assert.equal(imageData.byteLength, 3);
});

test("图片导出只作为工作台预览的输出动作", () => {
  const mainSource = read("src/main.ts");
  const workbenchSource = read("src/presentation/views/MergeWorkbenchView.ts");

  assert.doesNotMatch(mainSource, /export-card-as-image/);
  assert.doesNotMatch(mainSource, /export-selection-as-image/);
  assert.doesNotMatch(mainSource, /export-selected-cards-as-image/);
  assert.match(workbenchSource, /onExportImage/);
  assert.match(workbenchSource, /workbench\.button\.exportImage/);
});

test("工作台图片导出使用当前预览和工作台快照", async () => {
  const { TFile } = await import("./stubs/obsidian");
  const { MergeService } = await import("../src/services/MergeService");
  const canvasFile = Object.assign(new TFile(), {
    extension: "canvas",
    path: "folder/Board.canvas",
    basename: "Board",
  });
  const state: WorkbenchState = {
    canvasFilePath: canvasFile.path,
    canvasFileBasename: canvasFile.basename,
    scopeLabel: "selection",
    selectionSnapshot: [
      { id: "a", text: "first", x: 0, y: 0, width: 100, height: 60 },
      { id: "b", text: "second", x: 0, y: 80, width: 100, height: 60 },
    ],
    sortMode: "position",
    manualOrderIds: ["b", "a"],
    isManualAdjusted: true,
    previewExpanded: true,
    lastComputedContent: "second\n\nfirst",
    cardSeparator: null,
  };
  const previewElement = {} as HTMLElement;
  let received:
    | { element: HTMLElement; file: { path: string }; nodeCount: number }
    | undefined;
  const imageExporter = {
    async exportPreview(element: HTMLElement, file: { path: string }, nodeCount: number) {
      received = { element, file, nodeCount };
      return { path: "folder/Board-preview-2.png" };
    },
  };
  const service = new MergeService(
    {
      vault: {
        getAbstractFileByPath: () => canvasFile,
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    undefined,
    undefined,
    imageExporter as never,
  );
  const context = (service as unknown as {
    createWorkbenchContext(
      workbenchState: WorkbenchState,
      sortPriority: "yx",
    ): { onExportImage(state: WorkbenchState, element: HTMLElement): Promise<void> };
  }).createWorkbenchContext(state, "yx");

  await context.onExportImage(state, previewElement);

  assert.deepEqual(received, {
    element: previewElement,
    file: canvasFile,
    nodeCount: 2,
  });
});
