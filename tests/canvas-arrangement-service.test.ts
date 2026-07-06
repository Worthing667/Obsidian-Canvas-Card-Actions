import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import type { Canvas, CanvasData, CanvasNode, CanvasNodeData } from "../src/types/canvas";

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

function createTextNode(data: CanvasNodeData): CanvasNode {
    return {
        id: data.id,
        getData: () => data,
    } as CanvasNode;
}

function createCanvas(nodes: CanvasNodeData[]): Canvas & { getSavedData: () => CanvasData } {
    let data: CanvasData = {
        nodes: nodes.map((node) => ({ ...node })),
        edges: [],
    };

    const canvasNodes = data.nodes.map(createTextNode);

    return {
        selection: new Set(canvasNodes),
        getSelectionData: () => ({
            nodes: data.nodes.map((node) => ({ ...node })),
            edges: [],
        }),
        getData: () => ({
            nodes: data.nodes.map((node) => ({ ...node })),
            edges: [],
        }),
        setData: async (nextData) => {
            data = nextData;
        },
        requestSave: async () => undefined,
        getSavedData: () => data,
    };
}

test("水平整理可固定右侧卡片并向左调整间距", async () => {
    const { arrangeSelectedTextCardSpacing } = await import(
        "../src/services/CanvasArrangementService"
    );
    const canvas = createCanvas([
        { id: "left", type: "text", text: "left", x: 0, y: 10, width: 100, height: 80 },
        { id: "middle", type: "text", text: "middle", x: 300, y: 30, width: 50, height: 80 },
        { id: "right", type: "text", text: "right", x: 500, y: 50, width: 120, height: 80 },
    ]);

    await arrangeSelectedTextCardSpacing(canvas, {
        horizontalSpacing: 20,
        horizontalAnchor: "end",
    });

    assert.deepEqual(
        canvas.getSavedData().nodes.map((node) => ({ id: node.id, x: node.x, y: node.y })),
        [
            { id: "left", x: 310, y: 10 },
            { id: "middle", x: 430, y: 30 },
            { id: "right", x: 500, y: 50 },
        ]
    );
});

test("垂直整理可固定下方卡片并向上调整间距", async () => {
    const { arrangeSelectedTextCardSpacing } = await import(
        "../src/services/CanvasArrangementService"
    );
    const canvas = createCanvas([
        { id: "top", type: "text", text: "top", x: 10, y: 0, width: 100, height: 60 },
        { id: "middle", type: "text", text: "middle", x: 30, y: 200, width: 100, height: 80 },
        { id: "bottom", type: "text", text: "bottom", x: 50, y: 500, width: 100, height: 100 },
    ]);

    await arrangeSelectedTextCardSpacing(canvas, {
        verticalSpacing: 30,
        verticalAnchor: "end",
    });

    assert.deepEqual(
        canvas.getSavedData().nodes.map((node) => ({ id: node.id, x: node.x, y: node.y })),
        [
            { id: "top", x: 10, y: 300 },
            { id: "middle", x: 30, y: 390 },
            { id: "bottom", x: 50, y: 500 },
        ]
    );
});

test("整理间距偏好会记住上次使用的方向和固定边", async () => {
    const { ArrangeSessionPreferenceStore } = await import(
        "../src/services/CanvasArrangementService"
    );
    const store = new ArrangeSessionPreferenceStore();

    assert.deepEqual(store.get(), {
        direction: "horizontal",
        horizontalSpacing: 0,
        verticalSpacing: 0,
        horizontalAnchor: "start",
        verticalAnchor: "start",
    });

    store.remember({
        direction: "vertical",
        horizontalSpacing: 12,
        verticalSpacing: 24,
        horizontalAnchor: "end",
        verticalAnchor: "end",
    });

    assert.deepEqual(store.get(), {
        direction: "vertical",
        horizontalSpacing: 12,
        verticalSpacing: 24,
        horizontalAnchor: "end",
        verticalAnchor: "end",
    });
});
