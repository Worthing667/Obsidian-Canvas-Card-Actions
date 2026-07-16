import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

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

test("卡片图片保存在当前 Canvas 目录并避免覆盖同名文件", async () => {
  const { VaultAdapter } = await import("../src/adapters/VaultAdapter");
  let createdPath = "";
  let createdData: ArrayBuffer | undefined;
  const app = {
    vault: {
      getAbstractFileByPath(path: string) {
        return path.endsWith(".png") && !path.endsWith("-1.png") ? {} : null;
      },
      async createBinary(path: string, data: ArrayBuffer) {
        createdPath = path;
        createdData = data;
        return { path };
      },
    },
  };
  const adapter = new VaultAdapter(app as never);
  const data = new Uint8Array([1, 2, 3]).buffer;

  const result = await adapter.createCardImage(
    data,
    {
      basename: "Idea:board",
      parent: { path: "folder" },
    } as never,
    2,
  );

  assert.match(
    createdPath,
    /^folder\/Idea-board-selection-2-\d{8}-\d{6}-1\.png$/,
  );
  assert.equal(createdData, data);
  assert.equal(result.path, createdPath);
});
