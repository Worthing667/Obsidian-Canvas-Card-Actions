import * as assert from "node:assert/strict";
import { test } from "node:test";

class MockHTMLElement {
    dataset: Record<string, string> = {};

    instanceOf<T>(type: { new(): T }): this is MockHTMLElement & T {
        return this instanceof type;
    }

    querySelector(): null {
        return null;
    }
}

(globalThis as typeof globalThis & { HTMLElement: typeof HTMLElement }).HTMLElement =
    MockHTMLElement as unknown as typeof HTMLElement;

function syncBadgeMode(canvas: Record<string, unknown>): string | undefined {
    const wrapper = new MockHTMLElement();
    const { CanvasPerformanceModeService } = require("../src/services/CanvasPerformanceModeService");
    const service = new CanvasPerformanceModeService({
        workspace: {
            getLeavesOfType: () => [{ view: { canvas: { ...canvas, wrapperEl: wrapper } } }],
        },
    } as never);

    service.syncCanvasWrappers(true);
    return wrapper.dataset.canvasLoomBadgeMode;
}

test("性能模式优先按 Canvas 的实际 scale 判断低缩放", () => {
    assert.equal(
        syncBadgeMode({ scale: 0.5, tZoom: -1, zoom: -1 }),
        "compact"
    );
});

test("缺少 scale 时性能模式将 tZoom 转换为实际倍率", () => {
    assert.equal(
        syncBadgeMode({ tZoom: Math.log2(0.5), zoom: Math.log2(0.5) }),
        "compact"
    );
    assert.equal(
        syncBadgeMode({ tZoom: Math.log2(1.5), zoom: Math.log2(1.5) }),
        "full"
    );
});
