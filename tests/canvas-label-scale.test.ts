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

    instanceOf<T>(type: { new(): T }): this is MockHTMLElement & T {
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

    static reset(): void {
        MockMutationObserver.instances = [];
    }
}

function createService() {
    const { CanvasLabelScaleService } = require("../src/services/CanvasLabelScaleService");
    return new CanvasLabelScaleService({
        workspace: {
            getLeavesOfType: () => [],
        },
    } as never);
}

function createWrapper(initialZoomMultiplier?: string): MockHTMLElement {
    const wrapper = new MockHTMLElement();
    if (initialZoomMultiplier) {
        wrapper.style.setProperty("--zoom-multiplier", initialZoomMultiplier);
    }
    return wrapper;
}

(globalThis as typeof globalThis & { HTMLElement: typeof HTMLElement }).HTMLElement =
    MockHTMLElement as unknown as typeof HTMLElement;
(globalThis as typeof globalThis & { MutationObserver: typeof MutationObserver }).MutationObserver =
    MockMutationObserver as unknown as typeof MutationObserver;

// Given: wrapper 没有自然缩放
// When: 应用 0% 补偿
// Then: 不创建 observer，wrapper 保持不变
test("0% 补偿不创建 observer，wrapper 保持原值", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("0.5");

    // 构造 leaves 返回 wrapper
    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(0);

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "0.5");
    assert.equal(MockMutationObserver.instances.length, 0);
    assert.equal(wrapper.dataset.canvasLabelZoomCompensation, undefined);
});

// Given: wrapper 的 --zoom-multiplier 为 0.5
// When: 应用 100% 补偿
// Then: --zoom-multiplier 被设为 1
test("100% 补偿将 zoom-multiplier 固定为 1", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("0.5");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(100);

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");
    assert.equal(wrapper.style.getPropertyPriority("--zoom-multiplier"), "");
    assert.equal(wrapper.dataset.canvasLabelZoomCompensation, "100");
});

// Given: wrapper 应用了 100% 补偿，值为 "1"
// When: Obsidian 将 --zoom-multiplier 改为 0.75
// Then: observer 将其恢复为 "1"
test("100% 补偿下 Obsidian 修改值后被恢复为 1", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("0.5");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(100);

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");

    // 模拟 Obsidian 修改
    wrapper.style.setProperty("--zoom-multiplier", "0.75");
    MockMutationObserver.instances[0].flush();

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");
});

// Given: wrapper 的 --zoom-multiplier 为 0.5
// When: 应用 50% 补偿
// Then: target = 0.5 + (1 - 0.5) * 0.5 = 0.75
test("50% 补偿插值计算 (naturalZoom=0.5 → target=0.75)", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("0.5");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(50);

    // 0.5 + (1-0.5)*0.5 = 0.5 + 0.25 = 0.75
    const value = wrapper.style.getPropertyValue("--zoom-multiplier");
    const num = parseFloat(value);
    assert.ok(Math.abs(num - 0.75) < 0.001, `期望 0.75，实际 ${value}`);
    assert.equal(wrapper.dataset.canvasLabelZoomCompensation, "50");
});

// Given: wrapper 的 --zoom-multiplier 为 2
// When: 应用 100% 补偿
// Then: 放大场景也回到默认可读倍率 1，而不是继续放大
test("100% 补偿在放大场景也将 zoom-multiplier 固定为 1", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("2");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(100);

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");
    assert.equal(wrapper.dataset.canvasLabelZoomCompensation, "100");
});

// Given: wrapper 的 --zoom-multiplier 不是有效正数
// When: 应用 100% 补偿
// Then: 保留 Obsidian 原始值，不强行写入 1
test("无效自然缩放值不做补偿", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("invalid");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(100);

    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "invalid");
    assert.equal(wrapper.dataset.canvasLabelZoomCompensation, "100");
});

// Given: wrapper 应用了 50% 补偿，naturalZoom=0.5，当前 target=0.75
// When: Obsidian 将 naturalZoom 改为 0.3
// Then: observer 检测到变更，target = 0.3 + (1-0.3)*0.5 = 0.65
test("50% 补偿下 Obsidian 修改值后重新插值", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("0.5");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(50);

    const firstValue = parseFloat(wrapper.style.getPropertyValue("--zoom-multiplier"));
    assert.ok(Math.abs(firstValue - 0.75) < 0.001);

    // 模拟 Obsidian 修改
    wrapper.style.setProperty("--zoom-multiplier", "0.3");
    MockMutationObserver.instances[0].flush();

    const newValue = parseFloat(wrapper.style.getPropertyValue("--zoom-multiplier"));
    assert.ok(Math.abs(newValue - 0.65) < 0.001, `期望 0.65，实际 ${newValue}`);
});

// Given: wrapper 应用了 50% 补偿
// When: 将补偿改为 100%，再将补偿改为 0%
// Then: 同一 wrapper 上连续切换正确
test("同一 wrapper 上连续切换补偿级别", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("0.5");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];

    // 50% → 0.75
    service.syncCanvasWrappers(50);
    assert.ok(
        Math.abs(parseFloat(wrapper.style.getPropertyValue("--zoom-multiplier")) - 0.75) < 0.001
    );

    // 100% → 1
    service.syncCanvasWrappers(100);
    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");

    // 0% → 恢复原始值 0.5
    service.syncCanvasWrappers(0);
    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "0.5");
    assert.equal(wrapper.dataset.canvasLabelZoomCompensation, undefined);
});

// Given: wrapper 应用了 100% 补偿
// When: 关闭补偿 (0%)
// Then: 恢复关闭前的 Obsidian 自然值
test("关闭补偿后恢复 Obsidian 最新自然值", async () => {
    MockMutationObserver.reset();
    const service = createService();
    const wrapper = createWrapper("0.5");

    (service as any).app.workspace.getLeavesOfType = () => [{
        view: { canvas: { wrapperEl: wrapper } },
    }];
    service.syncCanvasWrappers(100);
    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");

    // 模拟 Obsidian 在覆盖期间修改
    wrapper.style.setProperty("--zoom-multiplier", "0.75");
    MockMutationObserver.instances[0].flush();
    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "1");

    // 关闭补偿 → 恢复 naturalZoom (= 0.75, observer 捕获的最新值)
    service.syncCanvasWrappers(0);
    assert.equal(wrapper.style.getPropertyValue("--zoom-multiplier"), "0.75");
});

// Given: styles.css 已发布
// When: 检查样式表内容
// Then: 不应包含 !important 覆盖 --zoom-multiplier
test("发布样式不使用 important 覆盖缩放变量", () => {
    const styles = readFileSync(resolve("styles.css"), "utf8");

    assert.doesNotMatch(styles, /--zoom-multiplier:[^;]*!important/);
});
