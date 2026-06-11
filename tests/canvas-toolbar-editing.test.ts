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

function createBadgedTextNode(id: string, badge?: string, isEditing = false): CanvasNode {
    return {
        ...createTextNode(id, isEditing),
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

test("序号工具只为非编辑态文本卡片选区显示，并统计已有标记", async () => {
    const {
        countSelectedBadges,
        getSequenceToolsSelectionState,
        shouldShowSequenceToolsToolbarButton,
    } = await import("../src/services/CanvasSelectionToolbarService");
    const selection = new Set([
        createBadgedTextNode("first", "1"),
        createBadgedTextNode("second"),
    ]);

    assert.equal(shouldShowSequenceToolsToolbarButton(selection), true);
    assert.equal(countSelectedBadges(selection), 1);
    assert.deepEqual(getSequenceToolsSelectionState(selection), {
        mode: "multiple",
        nodes: Array.from(selection),
        badgeCount: 1,
        currentBadge: null,
    });
    assert.equal(
        shouldShowSequenceToolsToolbarButton(new Set([createBadgedTextNode("editing", "2", true)])),
        false
    );
    assert.equal(
        shouldShowSequenceToolsToolbarButton(new Set([{
            id: "group",
            getData: () => ({
                id: "group",
                type: "group",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
            }),
        } as CanvasNode])),
        false
    );
});

test("单张卡片序号工具保留当前标记并使用单卡片模式", async () => {
    const { getSequenceToolsSelectionState } = await import(
        "../src/services/CanvasSelectionToolbarService"
    );
    const node = createBadgedTextNode("single", "2.1");

    assert.deepEqual(getSequenceToolsSelectionState(new Set([node])), {
        mode: "single",
        nodes: [node],
        badgeCount: 1,
        currentBadge: "2.1",
    });
});

test("右键序号工具命令复用统一打开入口", async () => {
    const { OpenSequenceToolsCommand } = await import(
        "../src/presentation/commands/BadgeCommands"
    );
    const selection = [createBadgedTextNode("first", "1")];
    let openCalls = 0;
    const command = new OpenSequenceToolsCommand(
        () => {
            openCalls += 1;
        },
        selection,
        () => true
    );

    await command.execute();

    assert.equal(openCalls, 1);
});
