import { setIcon, View, type App, type EventRef } from "obsidian";
import type { Canvas } from "../types/canvas";

type CanvasViewLike = {
	canvas?: Canvas;
	containerEl?: HTMLElement;
};

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;
const MIN_ZOOM_PERCENT = MIN_ZOOM * 100;
const MAX_ZOOM_PERCENT = MAX_ZOOM * 100;
const ZOOM_SLIDER_STEP_PERCENT = 5;
const POLL_INTERVAL_MS = 200;
const INTERNAL_ZOOM_DISPLAY_LOCK_MS = 1000;

type ViewportState = {
	tx: number;
	ty: number;
	zoom: number;
};

export class CanvasZoomControlService {
	private controlEl: HTMLElement | null = null;
	private currentWrapperEl: HTMLElement | null = null;
	private currentCanvas: Canvas | null = null;
	private pollTimerId: number | null = null;
	private lastRequestedZoom: number | null = null;
	private internalZoomDisplayLockUntil = 0;
	private isEnabled = true;
	private activeLeafUnsub: EventRef | null = null;
	private boundOnStepClick: (e: MouseEvent) => void;
	private boundOnSliderInput: (e: Event) => void;
	private boundOnInputChange: (e: Event) => void;
	private boundOnInputBlur: (e: Event) => void;

	constructor(private app: Pick<App, "workspace">) {
		this.boundOnStepClick = this.onStepClick.bind(this);
		this.boundOnSliderInput = this.onSliderInput.bind(this);
		this.boundOnInputChange = this.onInputChange.bind(this);
		this.boundOnInputBlur = this.onInputBlur.bind(this);
	}

	// ============================================================
	// 生命周期
	// ============================================================

	start(): void {
		if (this.activeLeafUnsub) return;

		this.activeLeafUnsub = this.app.workspace.on(
			"active-leaf-change",
			() => this.syncControl()
		);

		// 初始同步：如果当前活跃视图已经是 canvas，立即注入
		this.syncControl();
	}

	stop(): void {
		this.stopPolling();
		this.removeControl();

		if (this.activeLeafUnsub) {
			this.app.workspace.offref(this.activeLeafUnsub);
			this.activeLeafUnsub = null;
		}
	}

	setEnabled(enabled: boolean): void {
		this.isEnabled = enabled;
		if (enabled) {
			this.syncControl();
		} else {
			this.stopPolling();
			this.removeControl();
		}
	}

	// ============================================================
	// 控件同步
	// ============================================================

	private syncControl(): void {
		if (!this.isEnabled) {
			this.stopPolling();
			this.removeControl();
			return;
		}

		const resolved = this.resolveCanvasFromActiveView();
		if (!resolved) {
			this.stopPolling();
			this.removeControl();
			return;
		}

		const { canvas, wrapperEl } = resolved;
		if (wrapperEl === this.currentWrapperEl) {
			return; // 已经在正确位置，不重复注入
		}

		// 切换画布：移除旧控件，注入新控件
		this.stopPolling();
		this.removeControl();
		this.injectControl(wrapperEl, canvas);
		this.startPolling();
	}

	// ============================================================
	// 控件注入 / 移除
	// ============================================================

	private injectControl(wrapperEl: HTMLElement, canvas: Canvas): void {
		this.currentWrapperEl = wrapperEl;
		this.currentCanvas = canvas;

		const doc = wrapperEl.ownerDocument;
		this.controlEl = doc.createElement("div");
		this.controlEl.className = "canvas-loom-zoom-control";

		const adjustGroup = doc.createElement("div");
		adjustGroup.className = "canvas-loom-zoom-adjust";

		// 减号按钮
		const decBtn = doc.createElement("button");
		decBtn.className = "canvas-loom-zoom-step";
		decBtn.dataset.action = "decrease";
		decBtn.ariaLabel = "Zoom out";
		decBtn.title = "Zoom out";
		setIcon(decBtn, "minus");
		decBtn.addEventListener("click", this.boundOnStepClick);
		adjustGroup.appendChild(decBtn);

		const sliderEl = doc.createElement("input");
		sliderEl.className = "canvas-loom-zoom-slider";
		sliderEl.type = "range";
		sliderEl.min = String(MIN_ZOOM_PERCENT);
		sliderEl.max = String(MAX_ZOOM_PERCENT);
		sliderEl.step = String(ZOOM_SLIDER_STEP_PERCENT);
		sliderEl.ariaLabel = "Zoom percentage";
		sliderEl.addEventListener("input", this.boundOnSliderInput);
		adjustGroup.appendChild(sliderEl);

		const inputWrapEl = doc.createElement("label");
		inputWrapEl.className = "canvas-loom-zoom-input-wrap";

		const inputEl = doc.createElement("input");
		inputEl.className = "canvas-loom-zoom-input";
		inputEl.type = "number";
		inputEl.min = String(MIN_ZOOM_PERCENT);
		inputEl.max = String(MAX_ZOOM_PERCENT);
		inputEl.step = String(ZOOM_SLIDER_STEP_PERCENT);
		inputEl.placeholder = `${MIN_ZOOM_PERCENT}-${MAX_ZOOM_PERCENT}`;
		inputEl.ariaLabel = "Zoom percentage";
		inputEl.addEventListener("change", this.boundOnInputChange);
		inputEl.addEventListener("blur", this.boundOnInputBlur);
		inputWrapEl.appendChild(inputEl);

		const suffixEl = doc.createElement("span");
		suffixEl.className = "canvas-loom-zoom-input-suffix";
		suffixEl.textContent = "%";
		inputWrapEl.appendChild(suffixEl);
		adjustGroup.appendChild(inputWrapEl);

		// 加号按钮
		const incBtn = doc.createElement("button");
		incBtn.className = "canvas-loom-zoom-step";
		incBtn.dataset.action = "increase";
		incBtn.ariaLabel = "Zoom in";
		incBtn.title = "Zoom in";
		setIcon(incBtn, "plus");
		incBtn.addEventListener("click", this.boundOnStepClick);
		adjustGroup.appendChild(incBtn);

		this.controlEl.appendChild(adjustGroup);

		wrapperEl.appendChild(this.controlEl);

		// 立即更新一次显示
		this.updateDisplay(this.resolveZoom(canvas));
	}

	private removeControl(): void {
		if (this.controlEl) {
			this.controlEl.remove();
			this.controlEl = null;
		}
		this.currentWrapperEl = null;
		this.currentCanvas = null;
	}

	// ============================================================
	// 事件处理
	// ============================================================

	private onStepClick(e: MouseEvent): void {
		const btn = e.currentTarget as HTMLButtonElement;
		const action = btn.dataset.action;
		if (!this.currentCanvas || !this.currentWrapperEl) return;

		const currentZoom = this.resolveCurrentZoom(
			this.currentCanvas,
			this.currentWrapperEl
		);
		let newZoom: number;
		if (action === "increase") {
			newZoom = currentZoom + ZOOM_STEP;
		} else {
			newZoom = currentZoom - ZOOM_STEP;
		}
		this.applyZoom(this.currentCanvas, newZoom);
	}

	private onSliderInput(e: Event): void {
		const input = e.currentTarget as HTMLInputElement;
		const zoom = this.parsePercentZoom(input.value);
		if (zoom !== null && this.currentCanvas && this.currentWrapperEl) {
			this.applyZoom(this.currentCanvas, zoom);
		}
	}

	private onInputChange(e: Event): void {
		const input = e.currentTarget as HTMLInputElement;
		const zoom = this.parsePercentZoom(input.value);
		if (zoom !== null && this.currentCanvas && this.currentWrapperEl) {
			this.applyZoom(this.currentCanvas, zoom);
			return;
		}

		this.restoreCurrentDisplay();
	}

	private onInputBlur(e: Event): void {
		const input = e.currentTarget as HTMLInputElement;
		if (this.parsePercentZoom(input.value) === null) {
			this.restoreCurrentDisplay();
		}
	}

	// ============================================================
	// 缩放操作
	// ============================================================

	private applyZoom(canvas: Canvas, newZoom: number): void {
		const clamped = this.clampZoom(newZoom);
		const canvasViewport = this.readViewportFromCanvas(canvas);

		if (canvasViewport.zoom === clamped) {
			this.lastRequestedZoom = clamped;
			this.updateDisplay(clamped);
			return;
		}

		canvas.setViewport?.(
			canvasViewport.tx,
			canvasViewport.ty,
			this.scaleToCanvasZoom(clamped)
		);
		canvas.markViewportChanged?.();
		canvas.requestFrame?.();
		this.lastRequestedZoom = clamped;
		this.internalZoomDisplayLockUntil = Date.now() + INTERNAL_ZOOM_DISPLAY_LOCK_MS;

		this.updateDisplay(clamped);
	}

	// ============================================================
	// 显示更新
	// ============================================================

	private updateDisplay(zoom: number): void {
		if (!this.controlEl) return;

		const clampedZoom = this.clampZoom(zoom);
		const pct = this.zoomToPercent(clampedZoom);
		const sliderEl =
			this.controlEl.querySelector<HTMLInputElement>(".canvas-loom-zoom-slider");
		if (sliderEl) {
			sliderEl.value = String(pct);
		}

		const inputEl =
			this.controlEl.querySelector<HTMLInputElement>(".canvas-loom-zoom-input");
		if (inputEl) {
			inputEl.value = String(pct);
		}

		// 禁用到达边界的步进按钮
		const stepButtons =
			this.controlEl.querySelectorAll<HTMLButtonElement>(
				".canvas-loom-zoom-step"
			);
		stepButtons.forEach((btn) => {
			const action = btn.dataset.action;
			if (action === "decrease") {
				btn.disabled = clampedZoom <= MIN_ZOOM;
			} else if (action === "increase") {
				btn.disabled = clampedZoom >= MAX_ZOOM;
			}
		});
	}

	private restoreCurrentDisplay(): void {
		if (!this.currentCanvas || !this.currentWrapperEl) return;
		const zoom = this.resolveCurrentZoom(
			this.currentCanvas,
			this.currentWrapperEl
		);
		this.updateDisplay(zoom);
	}

	// ============================================================
	// 轮询
	// ============================================================

	private startPolling(): void {
		if (this.pollTimerId !== null) return;
		this.schedulePoll();
	}

	private stopPolling(): void {
		if (this.pollTimerId !== null) {
			window.clearTimeout(this.pollTimerId);
			this.pollTimerId = null;
		}
	}

	private schedulePoll(): void {
		this.pollTimerId = window.setTimeout(() => {
			this.pollTimerId = null;
			if (this.currentCanvas && this.currentWrapperEl) {
				// 确认控件仍然在 DOM 中（画布可能已被销毁）
				if (
					!this.controlEl ||
					!this.currentWrapperEl.contains(this.controlEl)
				) {
					this.removeControl();
					this.syncControl();
					return;
				}
				const zoom = this.resolveCurrentZoom(
					this.currentCanvas,
					this.currentWrapperEl
				);
				this.updateDisplay(zoom);
			}
			// 只有仍处于活跃状态才继续轮询
			if (this.currentWrapperEl) {
				this.schedulePoll();
			}
		}, POLL_INTERVAL_MS);
	}

	// ============================================================
	// 工具方法
	// ============================================================

	private resolveCanvasFromActiveView(): {
		canvas: Canvas;
		wrapperEl: HTMLElement;
	} | null {
		const activeView = this.app.workspace.getActiveViewOfType(View);
		if (!activeView) return null;

		const view = activeView as unknown as CanvasViewLike;
		if (!view.canvas) return null;

		const canvas = view.canvas;
		const wrapperEl = this.resolveWrapperEl(view);
		if (!wrapperEl) return null;

		return { canvas, wrapperEl };
	}

	private resolveWrapperEl(view: CanvasViewLike): HTMLElement | null {
		const wrapperEl = view.canvas?.wrapperEl;
		if (wrapperEl?.instanceOf(HTMLElement)) {
			return wrapperEl;
		}
		return view.containerEl?.querySelector(".canvas-wrapper") || null;
	}

	// ============================================================
	// DOM 视口读取
	// ============================================================

	private readZoomFromDOM(wrapperEl: HTMLElement): number | null {
		const viewportEl = this.findViewportElement(wrapperEl);
		if (!viewportEl) return null;

		const win = viewportEl.ownerDocument.defaultView;
		if (!win) return null;

		const computedStyle = win.getComputedStyle(viewportEl);
		const transform = computedStyle.transform;
		if (!transform || transform === "none") return null;

		try {
			const matrix = new win.DOMMatrix(transform);
			const zoom = matrix.a;

			if (!Number.isFinite(zoom)) return null;
			if (zoom <= 0) return null;

			return zoom;
		} catch {
			return null;
		}
	}

	/**
	 * 在 wrapperEl 内定位承载 viewport CSS transform 的 DOM 元素。
	 * 按优先级尝试多个策略，确保跨 Obsidian 版本兼容。
	 */
	private findViewportElement(wrapperEl: HTMLElement): HTMLElement | null {
		// 策略 1：wrapperEl 自身携带 inline transform
		if (wrapperEl.style.transform && wrapperEl.style.transform !== "none") {
			return wrapperEl;
		}

		// 策略 2：遍历直接子元素，查找带 inline transform 的元素
		for (let i = 0; i < wrapperEl.children.length; i++) {
			const child = wrapperEl.children[i];
			if (
				child instanceof HTMLElement &&
				child.style.transform &&
				child.style.transform !== "none"
			) {
				return child;
			}
		}

		// 策略 3：从任意 .canvas-node 向上遍历找到带 transform 的祖先
		const anyNode = wrapperEl.querySelector(".canvas-node");
		if (anyNode) {
			let parent: HTMLElement | null = anyNode.parentElement;
			while (parent && parent !== wrapperEl) {
				if (
					parent.style.transform &&
					parent.style.transform !== "none"
				) {
					return parent;
				}
				parent = parent.parentElement;
			}
		}

		return null;
	}

	private resolveZoom(canvas: Canvas): number {
		if (Number.isFinite(canvas.scale) && canvas.scale! > 0) {
			return canvas.scale!;
		}

		const canvasZoom = canvas.tZoom ?? canvas.zoom;
		if (Number.isFinite(canvasZoom)) {
			const scale = this.canvasZoomToScale(canvasZoom!);
			return scale > 0 ? scale : 1;
		}

		return 1;
	}

	private readViewportFromCanvas(canvas: Canvas): ViewportState {
		return {
			tx: Number.isFinite(canvas.tx) ? canvas.tx! : 0,
			ty: Number.isFinite(canvas.ty) ? canvas.ty! : 0,
			zoom: this.resolveZoom(canvas),
		};
	}

	private resolveCurrentZoom(canvas: Canvas, wrapperEl: HTMLElement): number {
		if (
			this.lastRequestedZoom !== null &&
			Date.now() < this.internalZoomDisplayLockUntil
		) {
			return this.lastRequestedZoom;
		}

		return this.readZoomFromDOM(wrapperEl) ?? this.lastRequestedZoom ?? this.resolveZoom(canvas);
	}

	private parsePercentZoom(value: string): number | null {
		const normalized = value.trim().replace(/%$/, "");
		if (!normalized) return null;

		const percent = Number(normalized);
		if (!Number.isFinite(percent)) return null;

		return this.clampZoom(percent / 100);
	}

	private clampZoom(zoom: number): number {
		return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
	}

	private zoomToPercent(zoom: number): number {
		return Math.round(this.clampZoom(zoom) * 100);
	}

	private scaleToCanvasZoom(scale: number): number {
		return Math.log2(scale);
	}

	private canvasZoomToScale(canvasZoom: number): number {
		return 2 ** canvasZoom;
	}
}
