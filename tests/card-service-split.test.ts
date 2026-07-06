import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import type { CanvasData, CanvasNode } from "../src/types/canvas";

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

test("按标题拆分时将标题前正文保留为独立卡片", async () => {
    const { CardService } = await import("../src/services/CardService");
    const { originalNode, data, adapter } = createSplitFixture("正文内容\n\n# 标题\n标题下内容");
    const service = new CardService(adapter as never);

    assert.deepEqual(service.getAvailableHeadingSplitOptions(originalNode), [
        { level: 1, cardCount: 2 },
    ]);

    await service.splitCardByHeadingLevel(originalNode, 1);

    assert.equal(data.nodes.length, 2);
    assert.equal(data.nodes[0].id, "original");
    assert.equal(data.nodes[0].text, "正文内容");
    assert.equal(data.nodes[1].text, "# 标题\n标题下内容");
    assert.equal(data.nodes[1].x, 330);
    assert.equal(data.nodes[1].y, 20);
    assert.equal(data.nodes[1].width, 300);
    assert.equal(data.nodes[1].height, 180);
});

test("标题在第一行时仍按标题卡片拆分", async () => {
    const { CardService } = await import("../src/services/CardService");
    const { originalNode, data, adapter } = createSplitFixture("# 第一节\n正文一\n# 第二节\n正文二");
    const service = new CardService(adapter as never);

    assert.deepEqual(service.getAvailableHeadingSplitOptions(originalNode), [
        { level: 1, cardCount: 2 },
    ]);

    await service.splitCardByHeadingLevel(originalNode, 1);

    assert.equal(data.nodes.length, 2);
    assert.equal(data.nodes[0].text, "# 第一节\n正文一");
    assert.equal(data.nodes[1].text, "# 第二节\n正文二");
});

test("按一级标题拆分时保留低级标题在所属卡片中", async () => {
    const { CardService } = await import("../src/services/CardService");
    const { originalNode, data, adapter } = createSplitFixture("引言\n# 第一节\n## 小节\n正文\n# 第二节\n正文二");
    const service = new CardService(adapter as never);

    assert.ok(
        service.getAvailableHeadingSplitOptions(originalNode).some(
            (option) => option.level === 1 && option.cardCount === 3
        )
    );

    await service.splitCardByHeadingLevel(originalNode, 1);

    assert.equal(data.nodes.length, 3);
    assert.equal(data.nodes[0].text, "引言");
    assert.equal(data.nodes[1].text, "# 第一节\n## 小节\n正文");
    assert.equal(data.nodes[2].text, "# 第二节\n正文二");
});

test("没有匹配标题时不提供标题拆分选项", async () => {
    const { CardService } = await import("../src/services/CardService");
    const { originalNode, adapter } = createSplitFixture("只有正文\n没有 Markdown 标题");
    const service = new CardService(adapter as never);

    assert.deepEqual(service.getAvailableHeadingSplitOptions(originalNode), []);
});

function createSplitFixture(text: string): {
    originalNode: CanvasNode;
    data: CanvasData;
    adapter: {
        mutateData: (mutator: (canvasData: CanvasData) => void) => Promise<CanvasData>;
        requestSave: () => Promise<void>;
    };
} {
    const originalNode = createNode({
        id: "original",
        type: "text",
        text,
        x: 10,
        y: 20,
        width: 300,
        height: 180,
    });
    const data: CanvasData = {
        nodes: [originalNode.getData()],
        edges: [],
    };
    const adapter = {
        mutateData: async (mutator: (canvasData: CanvasData) => void) => {
            mutator(data);
            return data;
        },
        requestSave: async () => undefined,
    };

    return { originalNode, data, adapter };
}

function createNode(data: CanvasData["nodes"][number]): CanvasNode {
    return {
        id: data.id,
        getData: () => data,
    };
}
