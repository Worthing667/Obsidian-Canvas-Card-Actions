import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
    getCanvasEditingNodes,
    hasCanvasEditingNode,
    isCanvasNodeEditing,
} from "../src/utils/canvasEditingState";
import type { Canvas, CanvasNode } from "../src/types/canvas";

function createNode(id: string, options: {
    isEditing?: boolean;
    hasEditingClass?: boolean;
    hasFocusedEditor?: boolean;
} = {}): CanvasNode {
    return {
        id,
        isEditing: options.isEditing,
        nodeEl: {
            classList: {
                contains: (className: string) =>
                    className === "is-editing" && options.hasEditingClass === true,
            },
            querySelector: () => options.hasFocusedEditor ? {} : null,
        } as unknown as HTMLElement,
        getData: () => ({
            id,
            type: "text",
            text: id,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        }),
    };
}

test("优先通过 Canvas 节点运行时状态识别编辑态", () => {
    assert.equal(isCanvasNodeEditing(createNode("a", { isEditing: true })), true);
});

test("运行时状态不可用时回退到节点 DOM 状态", () => {
    assert.equal(isCanvasNodeEditing(createNode("a", { hasEditingClass: true })), true);
    assert.equal(isCanvasNodeEditing(createNode("b", { hasFocusedEditor: true })), true);
});

test("只返回当前 Canvas 中正在编辑的节点", () => {
    const editingNode = createNode("editing", { isEditing: true });
    const idleNode = createNode("idle");
    const canvas = {
        nodes: new Map([
            [editingNode.id, editingNode],
            [idleNode.id, idleNode],
        ]),
    } as Canvas;

    assert.deepEqual(getCanvasEditingNodes(canvas), [editingNode]);
    assert.equal(hasCanvasEditingNode(canvas), true);
});
