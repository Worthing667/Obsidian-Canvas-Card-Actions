import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import type { CanvasNode, CanvasNodeData } from "../src/types/canvas";

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

void (async () => {
  const { ContentService } = await import("../src/services/ContentService");
  const { MergeService } = await import("../src/services/MergeService");

  function createTextNode(id: string, text: string, height: number): CanvasNode {
    return {
      id,
      getData: () => ({
        id,
        type: "text",
        text,
        x: 10,
        y: 20,
        width: 240,
        height,
      }),
    } as CanvasNode;
  }

  function createMergeService(onAutoFit: () => void) {
    const canvasData = { nodes: [] as CanvasNodeData[], edges: [] };
    let mergedRuntimeNode: CanvasNode | null = null;
    const canvasAdapter = {
      mutateData: async (mutation: (data: typeof canvasData) => void) => {
        mutation(canvasData);
        const data = canvasData.nodes.at(-1);
        if (data) {
          mergedRuntimeNode = {
            id: data.id,
            getData: () => data,
            onResizeDblclick: onAutoFit,
          };
        }
      },
      findNodeById: (id: string) => mergedRuntimeNode?.id === id ? mergedRuntimeNode : null,
      requestSave: async () => undefined,
    };
    const contentService = new ContentService(
      canvasAdapter as never,
      {} as never,
      { getCurrentBadge: async () => undefined } as never
    );

    return new MergeService(
      {} as never,
      canvasAdapter as never,
      contentService,
      {} as never
    );
  }

  test("直接拼合后会自动适应新卡片高度", async () => {
    let autoFitCount = 0;
    const service = createMergeService(() => {
      autoFitCount += 1;
    });

    const success = await service.mergeToCanvasCard([
      createTextNode("first", "第一张", 100),
      createTextNode("second", "第二张", 120),
    ]);

    assert.equal(success, true);
    assert.equal(autoFitCount, 1);
  });

  test("工作台快照拼合后会自动适应新卡片高度", async () => {
    let autoFitCount = 0;
    const service = createMergeService(() => {
      autoFitCount += 1;
    });

    const success = await service.mergeSnapshotsToCanvasCard([
      { id: "first", text: "第一张", x: 10, y: 20, width: 240, height: 100 },
      { id: "second", text: "第二张", x: 10, y: 140, width: 240, height: 120 },
    ], null);

    assert.equal(success, true);
    assert.equal(autoFitCount, 1);
  });
})();
