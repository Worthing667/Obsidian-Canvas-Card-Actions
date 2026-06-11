import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import type { Canvas, CanvasData, CanvasNode } from "../src/types/canvas";

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

test("编辑态下拒绝整份 Canvas 数据写回", async () => {
    const { CanvasAdapter } = await import("../src/adapters/CanvasAdapter");
    let setDataCallCount = 0;
    const editingNode = {
        id: "editing",
        isEditing: true,
        getData: () => ({
            id: "editing",
            type: "text",
            text: "old",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        }),
    } as CanvasNode;
    const canvas = {
        nodes: new Map([[editingNode.id, editingNode]]),
        getData: () => ({ nodes: [editingNode.getData()], edges: [] }),
        setData: () => {
            setDataCallCount += 1;
        },
        requestSave: () => undefined,
    } as Canvas;
    const nextData: CanvasData = {
        nodes: [{ ...editingNode.getData(), text: "replacement" }],
        edges: [],
    };

    await assert.rejects(() => new CanvasAdapter(canvas).setData(nextData));
    assert.equal(setDataCallCount, 0);
});

test("查找替换在编辑态下不读取或修改 Canvas 数据", async () => {
    const { SearchReplaceService } = await import("../src/services/SearchReplaceService");
    let getDataCallCount = 0;
    let mutateDataCallCount = 0;
    const adapter = {
        hasEditingNode: () => true,
        getData: () => {
            getDataCallCount += 1;
            return { nodes: [], edges: [] };
        },
        mutateData: async () => {
            mutateDataCallCount += 1;
            return { nodes: [], edges: [] };
        },
        requestSave: async () => undefined,
    };
    const service = new SearchReplaceService(adapter as never);
    const options = {
        query: "old",
        replacement: "new",
        scope: "canvas" as const,
        caseSensitive: false,
        regex: false,
    };

    const findResult = service.findMatches(options);
    const replaceResult = await service.replaceAll(options);

    assert.equal(findResult.error, "Exit card editing before modifying the Canvas");
    assert.equal(replaceResult.error, "Exit card editing before modifying the Canvas");
    assert.equal(getDataCallCount, 0);
    assert.equal(mutateDataCallCount, 0);
});

test("内容快照与拆分分析不读取编辑中的卡片", async () => {
    const { ContentService } = await import("../src/services/ContentService");
    const { CardService } = await import("../src/services/CardService");
    const editingNode = {
        id: "editing",
        isEditing: true,
        getData: () => ({
            id: "editing",
            type: "text",
            text: "# One\nbody\n# Two\nbody",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        }),
    } as CanvasNode;
    const adapter = {
        getSelectedNodes: () => [editingNode],
    };
    const contentService = new ContentService(
        adapter as never,
        {} as never,
        { getCurrentBadge: async () => null } as never
    );
    const cardService = new CardService(adapter as never);

    await assert.rejects(
        () => contentService.createSelectionSnapshot([editingNode]),
        /Exit card editing before modifying the Canvas/
    );
    assert.deepEqual(cardService.getAvailableHeadingSplitOptions(editingNode), []);
});
