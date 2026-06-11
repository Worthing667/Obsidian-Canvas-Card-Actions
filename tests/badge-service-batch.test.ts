import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
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

(globalThis as typeof globalThis & { Element: typeof Element }).Element = class {} as typeof Element;

function createNode(id: string, badge?: string): CanvasNode {
  return {
    id,
    getData: () => ({
      id,
      type: "text",
      text: id,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      badge,
    }),
  } as CanvasNode;
}

void (async () => {
  const { BadgeService } = await import("../src/services/BadgeService");

  function createFixture() {
    const data = {
      nodes: [
        { id: "first", type: "text", text: "first", x: 0, y: 0, width: 100, height: 100, badge: "1" },
        { id: "second", type: "text", text: "second", x: 100, y: 0, width: 100, height: 100 },
      ],
      edges: [],
    };
    let setDataCalls = 0;
    let requestSaveCalls = 0;
    const service = new BadgeService({
      getData: () => data,
      setData: async () => {
        setDataCalls += 1;
      },
      getSelectedNodes: () => [],
      replaceSelection: () => undefined,
      findNodeById: () => null,
      requestSave: async () => {
        requestSaveCalls += 1;
      },
      mutateData: async () => data,
      updateNode: async () => undefined,
      addNode: async () => undefined,
      addNodes: async () => undefined,
      removeNodes: async () => undefined,
    }, () => false);

    return {
      data,
      service,
      getSetDataCalls: () => setDataCalls,
      getRequestSaveCalls: () => requestSaveCalls,
    };
  }

  test("批量设置只写入实际变化的标记", async () => {
    const fixture = createFixture();
    const nodes = [createNode("first", "1"), createNode("second")];

    assert.equal(await fixture.service.setBadges(nodes, ["1", "2"]), 1);
    assert.equal(fixture.data.nodes[1].badge, "2");
    assert.equal(fixture.getSetDataCalls(), 1);
    assert.equal(fixture.getRequestSaveCalls(), 1);

    assert.equal(await fixture.service.setBadges(nodes, ["1", "2"]), 0);
    assert.equal(fixture.getSetDataCalls(), 1);
    assert.equal(fixture.getRequestSaveCalls(), 1);
  });

  test("批量移除只处理已有标记，空操作不写盘", async () => {
    const fixture = createFixture();
    const nodes = [createNode("first", "1"), createNode("second")];

    assert.equal(await fixture.service.removeBadges(nodes), 1);
    assert.equal(fixture.data.nodes[0].badge, undefined);
    assert.equal(fixture.getSetDataCalls(), 1);
    assert.equal(fixture.getRequestSaveCalls(), 1);

    assert.equal(await fixture.service.removeBadges(nodes), 0);
    assert.equal(fixture.getSetDataCalls(), 1);
    assert.equal(fixture.getRequestSaveCalls(), 1);
  });
})();
