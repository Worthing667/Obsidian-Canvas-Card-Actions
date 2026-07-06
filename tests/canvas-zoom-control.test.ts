import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";

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

type Listener = (event: { currentTarget: MockElement }) => void;

function assertApproxEqual(actual: number | undefined, expected: number): void {
	assert.ok(actual !== undefined);
	assert.ok(
		Math.abs(actual - expected) < 0.000001,
		`expected ${actual} to be approximately ${expected}`
	);
}

class MockClassList {
	private readonly classes = new Set<string>();

	constructor(initial = "") {
		initial.split(/\s+/).filter(Boolean).forEach((name) => this.classes.add(name));
	}

	toggle(name: string, force: boolean): void {
		if (force) {
			this.classes.add(name);
		} else {
			this.classes.delete(name);
		}
	}

	contains(name: string): boolean {
		return this.classes.has(name);
	}

	setFromClassName(className: string): void {
		this.classes.clear();
		className.split(/\s+/).filter(Boolean).forEach((name) => this.classes.add(name));
	}
}

class MockElement {
	children: MockElement[] = [];
	dataset: Record<string, string> = {};
	disabled = false;
	textContent = "";
	type = "";
	value = "";
	min = "";
	max = "";
	step = "";
	classList = new MockClassList();
	inputEl = this;
	parentElement: MockElement | null = null;
	ownerDocument: MockDocument;
	style = {
		transform: "",
		width: "",
		setProperty: () => undefined,
		getPropertyValue: () => "",
		getPropertyPriority: () => "",
		removeProperty: () => "",
	};
	private listeners = new Map<string, Listener[]>();
	private classNameValue = "";

	constructor(ownerDocument: MockDocument, readonly tagName = "div") {
		this.ownerDocument = ownerDocument;
	}

	get className(): string {
		return this.classNameValue;
	}

	set className(value: string) {
		this.classNameValue = value;
		this.classList.setFromClassName(value);
	}

	appendChild(child: MockElement): MockElement {
		child.parentElement = this;
		this.children.push(child);
		return child;
	}

	remove(): void {
		if (!this.parentElement) return;
		this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
		this.parentElement = null;
	}

	contains(child: MockElement): boolean {
		return this.children.includes(child) || this.children.some((item) => item.contains(child));
	}

	addEventListener(type: string, listener: Listener): void {
		const listeners = this.listeners.get(type) || [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	}

	dispatch(type: string): void {
		(this.listeners.get(type) || []).forEach((listener) => {
			listener({ currentTarget: this });
		});
	}

	querySelector(selector: string): MockElement | null {
		return this.querySelectorAll(selector)[0] || null;
	}

	querySelectorAll(selector: string): MockElement[] {
		const className = selector.startsWith(".") ? selector.slice(1) : selector;
		const matches: MockElement[] = [];
		const visit = (element: MockElement) => {
			if (element.classList.contains(className)) {
				matches.push(element);
			}
			element.children.forEach(visit);
		};
		this.children.forEach(visit);
		return matches;
	}

	getBoundingClientRect(): Pick<DOMRect, "width" | "height"> {
		return { width: 1000, height: 800 };
	}

	instanceOf<T>(type: { new(): T }): this is MockElement & T {
		return this instanceof type;
	}
}

class MockDocument {
	defaultView = {
		getComputedStyle: (element: MockElement) => ({
			transform: element.style.transform || "none",
		}),
		DOMMatrix: class {
			a = 1;
			e = 0;
			f = 0;

			constructor(transform: string) {
				const match = transform.match(
					/matrix\(([-\d.e+]+),\s*[-\d.e+]+,\s*[-\d.e+]+,\s*[-\d.e+]+,\s*([-\d.e+]+),\s*([-\d.e+]+)\)/
				);
				if (!match) return;

				this.a = Number(match[1]);
				this.e = Number(match[2]);
				this.f = Number(match[3]);
			}
		},
	};

	createElement(tagName: string): MockElement {
		return new MockElement(this, tagName);
	}
}

function createHarness(options: {
	initialZoom?: number;
	initialTx?: number;
	initialTy?: number;
	domTransform?: string;
} = {}) {
	const {
		initialZoom = 1,
		initialTx = 0,
		initialTy = 0,
		domTransform = "",
	} = options;
	const doc = new MockDocument();
	const wrapper = new MockElement(doc);
	const viewport = new MockElement(doc);
	viewport.className = "canvas";
	viewport.style.transform = domTransform;
	wrapper.appendChild(viewport);

	const viewportCalls: Array<{ tx: number; ty: number; zoom: number; scale: number }> = [];
	let markViewportChangedCalls = 0;
	const canvas = {
		tx: initialTx,
		ty: initialTy,
		zoom: Math.log2(initialZoom),
		tZoom: Math.log2(initialZoom),
		scale: initialZoom,
		wrapperEl: wrapper,
		getData: () => ({ nodes: [], edges: [] }),
		setData: () => undefined,
		requestSave: () => undefined,
		requestFrame: () => undefined,
		markViewportChanged: () => {
			markViewportChangedCalls++;
		},
		setViewport: (tx: number, ty: number, zoom: number) => {
			canvas.tx = tx;
			canvas.ty = ty;
			canvas.zoom = zoom;
			canvas.tZoom = zoom;
			canvas.scale = 2 ** zoom;
			viewportCalls.push({ tx, ty, zoom, scale: canvas.scale });
		},
	};
	const activeView = { canvas };
	const app = {
		workspace: {
			on: () => ({}),
			offref: () => undefined,
			getActiveViewOfType: () => activeView,
		},
	};
	const timers: Array<() => void> = [];

	(globalThis as typeof globalThis & { HTMLElement: typeof HTMLElement }).HTMLElement =
		MockElement as unknown as typeof HTMLElement;
	(globalThis as any).window = {
		setTimeout: (callback: () => void) => {
			timers.push(callback);
			return timers.length;
		},
		clearTimeout: () => undefined,
	};

	const { CanvasZoomControlService } = require("../src/services/CanvasZoomControlService");
	const service = new CanvasZoomControlService(app as never);
	service.start();

	const control = wrapper.querySelector(".canvas-loom-zoom-control");
	assert.ok(control);

	return {
		control,
		viewport,
		viewportCalls,
		getMarkViewportChangedCalls: () => markViewportChangedCalls,
		runNextTimer: () => timers.shift()?.(),
	};
}

test("缩放输入框使用百分比语义，100 表示 zoom 1.0", () => {
	const { control, viewportCalls } = createHarness({ initialZoom: 0.5 });
	const input = control.querySelector(".canvas-loom-zoom-input");
	assert.ok(input);

	input.value = "100";
	input.dispatch("change");

	assertApproxEqual(viewportCalls.at(-1)?.scale, 1);
	assert.equal(input.value, "100");
});

test("缩放输入框会将百分比钳制在 10 到 200", () => {
	const { control, viewportCalls } = createHarness({ initialZoom: 1 });
	const input = control.querySelector(".canvas-loom-zoom-input");
	assert.ok(input);

	input.value = "800";
	input.dispatch("change");
	assertApproxEqual(viewportCalls.at(-1)?.scale, 2);
	assert.equal(input.value, "200");

	input.value = "5";
	input.dispatch("change");
	assertApproxEqual(viewportCalls.at(-1)?.scale, 0.1);
	assert.equal(input.value, "10");
});

test("缩放控件不渲染预设按钮", () => {
	const { control } = createHarness({ initialZoom: 1 });

	assert.equal(control.querySelectorAll(".canvas-loom-zoom-preset").length, 0);
	assert.equal(control.querySelectorAll(".canvas-loom-zoom-presets").length, 0);
});

test("缩放滑块和输入框同步百分比显示", () => {
	const { control, viewportCalls, getMarkViewportChangedCalls } = createHarness({ initialZoom: 1 });
	const slider = control.querySelector(".canvas-loom-zoom-slider");
	const input = control.querySelector(".canvas-loom-zoom-input");
	assert.ok(slider);
	assert.ok(input);

	slider.value = "150";
	slider.dispatch("input");

	assertApproxEqual(viewportCalls.at(-1)?.scale, 1.5);
	assert.equal(input.value, "150");
	assert.equal(slider.value, "150");
	assert.equal(getMarkViewportChangedCalls(), 1);
});

test("传给 Obsidian setViewport 的缩放值使用内部 log2 zoom", () => {
	const { control, viewportCalls } = createHarness({ initialZoom: 1 });
	const input = control.querySelector(".canvas-loom-zoom-input");
	assert.ok(input);

	input.value = "190";
	input.dispatch("change");

	assertApproxEqual(viewportCalls.at(-1)?.zoom, Math.log2(1.9));
});

test("缩放时不把 DOM matrix 位移当作 Canvas 视口坐标", () => {
	const { control, viewportCalls } = createHarness({
		initialZoom: 1,
		initialTx: -5266469.699203552,
		initialTy: -5268105.454671495,
		domTransform: "matrix(2, 0, 0, 2, 10533600, 10536700)",
	});
	const input = control.querySelector(".canvas-loom-zoom-input");
	assert.ok(input);

	input.value = "150";
	input.dispatch("change");

	assert.equal(viewportCalls.at(-1)?.tx, -5266469.699203552);
	assert.equal(viewportCalls.at(-1)?.ty, -5268105.454671495);
	assertApproxEqual(viewportCalls.at(-1)?.scale, 1.5);
});

test("内部拖动缩放期间不被 DOM 动画中间值写回", () => {
	const { control, viewport, runNextTimer } = createHarness({
		initialZoom: 2,
		domTransform: "matrix(2, 0, 0, 2, 0, 0)",
	});
	const slider = control.querySelector(".canvas-loom-zoom-slider");
	const input = control.querySelector(".canvas-loom-zoom-input");
	assert.ok(slider);
	assert.ok(input);

	slider.value = "10";
	slider.dispatch("input");
	viewport.style.transform = "matrix(1.07, 0, 0, 1.07, 0, 0)";
	runNextTimer();

	assert.equal(slider.value, "10");
	assert.equal(input.value, "10");
});
