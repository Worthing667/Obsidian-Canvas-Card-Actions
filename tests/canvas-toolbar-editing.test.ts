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

function createTextNode(id: string, isEditing = false): CanvasNode {
    return {
        id,
        isEditing,
        getData: () => ({
            id,
            type: "text",
            text: id,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        }),
        onResizeDblclick: () => undefined,
    } as CanvasNode;
}

test("卡片编辑时隐藏选择浮动工具栏入口", async () => {
    const { shouldShowArrangementToolbarButton } = await import(
        "../src/services/CanvasArrangementService"
    );
    const { shouldShowAutoHeightToolbarButton } = await import(
        "../src/services/CanvasAutoFitService"
    );
    const editingNode = createTextNode("editing", true);
    const otherNode = createTextNode("other");
    const selection = new Set([editingNode, otherNode]);

    assert.equal(shouldShowArrangementToolbarButton(selection), false);
    assert.equal(shouldShowAutoHeightToolbarButton(selection), false);
});
