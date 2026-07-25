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

test("工作台图片渲染器展开完整预览内容且不导出滚动条", async () => {
  const { HtmlToImageWorkbenchRenderer } = await import(
    "../src/services/WorkbenchImageExportService"
  );
  const previewElement = {
    clientWidth: 300,
    clientHeight: 200,
    scrollWidth: 300,
    scrollHeight: 800,
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({
          backgroundColor: "#ffffff",
          borderLeftWidth: "1px",
          borderRightWidth: "1px",
          borderTopWidth: "1px",
          borderBottomWidth: "1px",
        }),
      },
    },
  } as unknown as HTMLElement;
  let receivedOptions:
    | {
        width?: number;
        height?: number;
        style?: Partial<CSSStyleDeclaration>;
      }
    | undefined;
  const renderer = new HtmlToImageWorkbenchRenderer(async (_node, options) => {
    receivedOptions = options;
    return new Blob([new Uint8Array([1])], { type: "image/png" });
  });

  await renderer.render(previewElement);

  assert.equal(receivedOptions?.width, 302);
  assert.equal(receivedOptions?.height, 802);
  assert.equal(receivedOptions?.style?.overflow, "visible");
  assert.equal(receivedOptions?.style?.maxHeight, "none");
  assert.equal(receivedOptions?.style?.flex, "none");
});

test("图片导出只作为工作台预览的输出动作", () => {
  const mainSource = read("src/main.ts");
  const workbenchSource = read("src/presentation/views/MergeWorkbenchView.ts");

  assert.doesNotMatch(mainSource, /export-card-as-image/);
  assert.doesNotMatch(mainSource, /export-selection-as-image/);
  assert.doesNotMatch(mainSource, /export-selected-cards-as-image/);
  assert.match(mainSource, /ExportSingleCardAsImageCommand/);
  assert.match(mainSource, /menu\.exportCardAsImage/);
  assert.match(mainSource, /selectImageExportFolder/);
  assert.match(workbenchSource, /onExportImage/);
  assert.match(workbenchSource, /workbench\.button\.exportImage/);
});

test("图片导出将用户选择的文件夹传给写入器", async () => {
  const { WorkbenchImageExportService } = await import(
    "../src/services/WorkbenchImageExportService"
  );
  const previewElement = {} as HTMLElement;
  const canvasFile = { path: "Board.canvas" } as never;
  let receivedFolder: string | undefined;
  const service = new WorkbenchImageExportService(
    {
      async render() {
        return new Uint8Array([1]).buffer;
      },
    },
    {
      async createWorkbenchPreviewImage(_data, _file, _count, folderPath) {
        receivedFolder = folderPath;
        return { path: "exports/Board-preview-1.png" } as never;
      },
    },
  );

  await service.exportPreview(previewElement, canvasFile, 1, "exports");

  assert.equal(receivedFolder, "exports");
});

test("单张卡片右键导出使用卡片元素和所选文件夹", async () => {
  const { ExportSingleCardAsImageCommand } = await import(
    "../src/presentation/commands/ExportSingleCardAsImageCommand"
  );
  const { CommandRegistry } = await import(
    "../src/presentation/commands/CommandRegistry"
  );
  const nodeElement = {} as HTMLElement;
  const canvasFile = { extension: "canvas", path: "Board.canvas" } as never;
  const node = {
    nodeEl: nodeElement,
    getData: () => ({ type: "text", text: "card" }),
  } as never;
  let received:
    | { element: HTMLElement; file: unknown; count: number; folder: string | undefined }
    | undefined;
  const command = new ExportSingleCardAsImageCommand(
    {
      async exportPreview(element, file, count, folder) {
        received = { element, file, count, folder };
        return { path: "exports/Board-preview-1.png" } as never;
      },
    },
    node,
    canvasFile,
    async () => "exports",
  );

  const registry = new CommandRegistry();
  registry.registerCommand("export-single-card-as-image", command);
  await registry.executeCommand("export-single-card-as-image");

  assert.deepEqual(received, {
    element: nodeElement,
    file: canvasFile,
    count: 1,
    folder: "exports",
  });
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
