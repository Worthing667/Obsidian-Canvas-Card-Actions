import { View, type App, type EventRef } from "obsidian";
import type { Canvas } from "../types/canvas";

type CanvasViewLike = {
	canvas?: Canvas;
	containerEl?: HTMLElement;
};

const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5];
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const POLL_INTERVAL_MS = 200;
const PRESET_MATCH_THRESHOLD = 0.02;

export class CanvasZoomControlService {
	private controlEl: HTMLElement | null = null;
	private currentWrapperEl: HTMLElement | null = null;
	private currentCanvas: Canvas | null = null;
	private pollTimerId: number | null = null;
	private isEnabled = true;
	private activeLeafUnsub: EventRef | null = null;
	private boundOnPresetClick: (e: MouseEvent) => void;
	private boundOnStepClick: (e: MouseEvent) => void;

	constructor(private app: Pick<App, "workspace">) {
		this.boundOnPresetClick = this.onPresetClick.bind(this);
		this.boundOnStepClick = this.onStepClick.bind(this);
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

		// 预设按钮
		ZOOM_PRESETS.forEach((preset) => {
			const btn = doc.createElement("button");
			btn.className = "canvas-loom-zoom-preset";
			btn.dataset.zoom = String(preset);
			btn.textContent = `${Math.round(preset * 100)}%`;
			btn.addEventListener("click", this.boundOnPresetClick);
			this.controlEl!.appendChild(btn);
		});

		// 减号按钮
		const decBtn = doc.createElement("button");
		decBtn.className = "canvas-loom-zoom-step";
		decBtn.dataset.action = "decrease";
		decBtn.textContent = "−"; // minus sign
		decBtn.addEventListener("click", this.boundOnStepClick);
		this.controlEl.appendChild(decBtn);

		// 当前倍率显示
		const valueEl = doc.createElement("span");
		valueEl.className = "canvas-loom-zoom-value";
		this.controlEl.appendChild(valueEl);

		// 加号按钮
		const incBtn = doc.createElement("button");
		incBtn.className = "canvas-loom-zoom-step";
		incBtn.dataset.action = "increase";
		incBtn.textContent = "+";
		incBtn.addEventListener("click", this.boundOnStepClick);
		this.controlEl.appendChild(incBtn);

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

	private onPresetClick(e: MouseEvent): void {
		const btn = e.currentTarget as HTMLButtonElement;
		const zoom = parseFloat(btn.dataset.zoom || "");
		if (Number.isFinite(zoom) && this.currentCanvas && this.currentWrapperEl) {
			this.applyZoom(this.currentCanvas, this.currentWrapperEl, zoom);
		}
	}

	private onStepClick(e: MouseEvent): void {
		const btn = e.currentTarget as HTMLButtonElement;
		const action = btn.dataset.action;
		if (!this.currentCanvas || !this.currentWrapperEl) return;

		const currentZoom =
				this.readViewportFromDOM(this.currentWrapperEl)?.zoom ??
				this.resolveZoom(this.currentCanvas);
		let newZoom: number;
		if (action === "increase") {
			newZoom = currentZoom + ZOOM_STEP;
		} else {
			newZoom = currentZoom - ZOOM_STEP;
		}
		this.applyZoom(this.currentCanvas, this.currentWrapperEl, newZoom);
	}

	// ============================================================
	// 缩放操作
	// ============================================================

	private applyZoom(
		canvas: Canvas,
		wrapperEl: HTMLElement,
		newZoom: number
	): void {
		const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

		// 优先从 DOM 读取真实视口参数，避免 canvas 属性过时导致中心偏移
		const domViewport = this.readViewportFromDOM(wrapperEl);
		const currentZoom = domViewport?.zoom ?? this.resolveZoom(canvas);
		if (currentZoom === clamped) return;

		const rect = wrapperEl.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;

		const tx = domViewport?.tx ?? (canvas.tx ?? 0);
		const ty = domViewport?.ty ?? (canvas.ty ?? 0);

		// 计算视口中心在画布坐标系中的位置
		const centerX = (rect.width / 2 - tx) / currentZoom;
		const centerY = (rect.height / 2 - ty) / currentZoom;

		// 以中心点不变为前提，计算新的平移量
		const newTx = rect.width / 2 - centerX * clamped;
		const newTy = rect.height / 2 - centerY * clamped;

		canvas.setViewport?.(newTx, newTy, clamped);
		canvas.requestFrame?.();

		// 立即更新显示
		this.updateDisplay(clamped);
	}

	// ============================================================
	// 显示更新
	// ============================================================

	private updateDisplay(zoom: number): void {
		if (!this.controlEl) return;

		const pct = Math.round(zoom * 100);
		const valueEl =
			this.controlEl.querySelector<HTMLElement>(".canvas-loom-zoom-value");
		if (valueEl) {
			valueEl.textContent = `${pct}%`;
		}

		// 高亮匹配的预设按钮
		const presetButtons =
			this.controlEl.querySelectorAll<HTMLButtonElement>(
				".canvas-loom-zoom-preset"
			);
		presetButtons.forEach((btn) => {
			const presetZoom = parseFloat(btn.dataset.zoom || "");
			const isMatch =
				Number.isFinite(presetZoom) &&
				Math.abs(zoom - presetZoom) <= PRESET_MATCH_THRESHOLD;
			btn.classList.toggle("is-active", isMatch);
		});

		// 禁用到达边界的步进按钮
		const stepButtons =
			this.controlEl.querySelectorAll<HTMLButtonElement>(
				".canvas-loom-zoom-step"
			);
		stepButtons.forEach((btn) => {
			const action = btn.dataset.action;
			if (action === "decrease") {
				btn.disabled = zoom <= MIN_ZOOM;
			} else if (action === "increase") {
				btn.disabled = zoom >= MAX_ZOOM;
			}
		});
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
				const zoom = this.resolveZoom(this.currentCanvas);
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

	/**
	 * 从 DOM 读取真实的视口变换参数（translate + scale），
	 * 避免依赖可能过时的 canvas.tx / canvas.ty / canvas.tZoom。
	 * 返回 null 表示读取失败，调用方应回退到 canvas 属性。
	 */
	private readViewportFromDOM(
		wrapperEl: HTMLElement
	): { tx: number; ty: number; zoom: number } | null {
		const viewportEl = this.findViewportElement(wrapperEl);
		if (!viewportEl) return null;

		const win = viewportEl.ownerDocument.defaultView;
		if (!win) return null;

		const computedStyle = win.getComputedStyle(viewportEl);
		const transform = computedStyle.transform;
		if (!transform || transform === "none") return null;

		try {
			const matrix = new win.DOMMatrix(transform);
			const tx = matrix.e;
			const ty = matrix.f;
			const zoom = matrix.a;

			if (
				!Number.isFinite(tx) ||
				!Number.isFinite(ty) ||
				!Number.isFinite(zoom)
			) {
				return null;
			}
			if (zoom <= 0) return null;

			return { tx, ty, zoom };
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
		const zoom = canvas.tZoom ?? canvas.zoom ?? 1;
		return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	}
}
