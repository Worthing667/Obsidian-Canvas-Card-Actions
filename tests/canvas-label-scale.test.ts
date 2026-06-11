import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

class MockStyle {
    private readonly values = new Map<string, { value: string; priority: string }>();

    getPropertyValue(name: string): string {
        return this.values.get(name)?.value || "";
    }

    getPropertyPriority(name: string): string {
        return this.values.get(name)?.priority || "";
    }

    setProperty(name: string, value: string, priority = ""): void {
        this.values.set(name, { value, priority });
    }

    removeProperty(name: string): string {
        const value = this.getPropertyValue(name);
        this.values.delete(name);
        return value;
    }
}

class MockHTMLElement {
    dataset: Record<string, string> = {};
    style = new MockStyle();

    instanceOf<T>(type: { new (): T }): this is MockHTMLElement & T {
        return this instanceof type;
    }

    setCssProps(props: Record<string, string>): void {
        Object.entries(props).forEach(([name, value]) => {
            this.style.setProperty(name, value);
        });
    }

    querySelector(): null {
        return null;
    }
}

class MockMutationObserver {
    static instances: MockMutationObserver[] = [];

    private observed = false;

    constructor(private readonly callback: MutationCallback) {
        MockMutationObserver.instances.push(this);
    }

    observe(): void {
        this.observed = true;
    }

    disconnect(): void {
        this.observed = false;
    }

    flush(): void {
        if (this.observed) {
            this.callback([], this as unknown as MutationObserver);
        }
    }
}

(globalThis as typeof globalThis & { HTMLElement: typeof HTMLElement }).HTMLElement =
    MockHTMLElement as unknown as typeof HTMLElement;
(globalThis as typeof globalThis & { MutationObserver: typeof MutationObserver }).MutationObserver =
    MockMutationObserver as unknown as typeof MutationObserver;

test("标签缩放设置通过内联变量保持生效，并在关闭时恢复 Obsidian 最新值", async () => {
    const { CanvasLabelScaleService } = await import("../src/services/CanvasLabelScaleService");
    const wrapper = new MockHTMLElement();
    wrapper.style.setProperty("--zoom-multiplier", "0.5");
    const service = new CanvasLabelScaleService({
        workspace: {
            getLeavesOfType: () => [{
                view: {
                    canvas: {
                        wrapperEl: wrapper,
                    },
                },
            }],
        },
    } as never);

    service.syncCanvasWrappers(true);

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");
    assert.equal(wrapper.style.getPropertyPriority("--zoom-multiplier"), "");

    wrapper.style.setProperty("--zoom-multiplier", "0.75");
    MockMutationObserver.instances[0].flush();

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");

    service.syncCanvasWrappers(false);

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "0.75");
});

test("发布样式不使用 important 覆盖缩放变量", () => {
    const styles = readFileSync(resolve("styles.css"), "utf8");

    assert.doesNotMatch(styles, /--zoom-multiplier:[^;]*!important/);
});
