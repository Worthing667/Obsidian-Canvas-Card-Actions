import * as assert from "node:assert/strict";
import test from "node:test";

import type { CanvasEdge, CanvasNode } from "../src/types/canvas";

function createClassList(initial: string[] = []) {
  const values = new Set(initial);
  return {
    add: (...tokens: string[]) => tokens.forEach((token) => values.add(token)),
    contains: (token: string) => values.has(token),
    remove: (...tokens: string[]) => tokens.forEach((token) => values.delete(token)),
  };
}

function createElement(classNames: string[] = [], tagName = "DIV") {
  return {
    classList: createClassList(classNames),
    tagName,
  } as unknown as HTMLElement;
}

function createNode(
  id: string,
  data: Partial<ReturnType<CanvasNode["getData"]>> = {},
): CanvasNode {
  return {
    id,
    getData: () => ({
      id,
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      ...data,
    }),
  };
}

function createEdge(id: string, fromNode: string, toNode: string): CanvasEdge {
  return {
    id,
    getData: () => ({
      id,
      fromNode,
      fromSide: "right",
      toNode,
      toSide: "left",
    }),
  };
}

test("图片导出只接受去重后的文本卡片", async () => {
  const { selectExportableTextNodes } = await import(
    "../src/services/CardImageExportService"
  );
  const textNode = createNode("text-1");
  const fileNode = createNode("file-1", { type: "file", file: "note.md" });

  const result = selectExportableTextNodes([textNode, fileNode, textNode]);

  assert.deepEqual(
    result.map((node) => node.id),
    ["text-1"],
  );
});

test("图片导出只保留两个端点都在选区中的连线", async () => {
  const { selectInternalCanvasEdges } = await import(
    "../src/services/CardImageExportService"
  );
  const edges = [
    createEdge("inside", "a", "b"),
    createEdge("outside", "b", "c"),
    createEdge("reverse", "b", "a"),
  ];

  const result = selectInternalCanvasEdges(edges, new Set(["a", "b"]));

  assert.deepEqual(
    result.map((edge) => edge.id),
    ["inside", "reverse"],
  );
});

test("图片导出边界保留负坐标并加入留白", async () => {
  const { calculateCardImageExportBounds } = await import(
    "../src/services/CardImageExportService"
  );
  const nodes = [
    createNode("a", { x: -100, y: 20, width: 80, height: 60 }),
    createNode("b", { x: 50, y: -40, width: 100, height: 120 }),
  ];

  const bounds = calculateCardImageExportBounds(nodes, 24);

  assert.deepEqual(bounds, {
    minX: -124,
    minY: -64,
    maxX: 174,
    maxY: 104,
    width: 298,
    height: 168,
  });
});

test("图片导出会同时遵守最长边与总像素限制", async () => {
  const { calculateCardImagePixelRatio } = await import(
    "../src/services/CardImageExportService"
  );

  assert.equal(
    calculateCardImagePixelRatio(
      { width: 10_000, height: 5_000 },
      2,
      { maxDimension: 12_000, maxPixels: 64_000_000 },
    ),
    1.131370849898476,
  );
});

test("渲染失败后恢复选区、截图状态与临时样式", async () => {
  const {
    HtmlToImageCardRenderer,
    calculateCardImageExportBounds,
  } = await import("../src/services/CardImageExportService");
  const selectedElement = createElement(["canvas-node"]);
  const selectedNode = {
    ...createNode("a", { x: 10, y: 20 }),
    nodeEl: selectedElement,
  };
  const rootElement = createElement();
  const wrapperElement = createElement();
  let virtualizeCalls = 0;
  const canvas = {
    selection: new Set([selectedNode]),
    screenshotting: false,
    canvasEl: rootElement,
    wrapperEl: wrapperElement,
    requestFrame: () => undefined,
    virtualize: () => {
      virtualizeCalls += 1;
    },
    updateSelection(update: () => void) {
      update();
    },
  };
  const renderer = new HtmlToImageCardRenderer(async () => {
    throw new Error("render failed");
  });

  await assert.rejects(
    renderer.render(
      canvas as never,
      {
        nodes: [selectedNode],
        edges: [],
        bounds: calculateCardImageExportBounds([selectedNode], 24),
      },
      { pixelRatio: 2 },
    ),
    /render failed/,
  );

  assert.deepEqual(Array.from(canvas.selection), [selectedNode]);
  assert.equal(canvas.screenshotting, false);
  assert.equal(virtualizeCalls, 2);
  assert.equal(
    wrapperElement.classList.contains("canvas-loom-image-exporting"),
    false,
  );
});

test("渲染器裁切目标范围并过滤非目标节点、连线与媒体", async () => {
  const {
    HtmlToImageCardRenderer,
    calculateCardImageExportBounds,
  } = await import("../src/services/CardImageExportService");
  const selectedElement = createElement(["canvas-node"]);
  const otherElement = createElement(["canvas-node"]);
  const selectedNode = {
    ...createNode("a", { x: -100, y: 20, width: 80, height: 60 }),
    nodeEl: selectedElement,
  };
  const otherNode = {
    ...createNode("b"),
    nodeEl: otherElement,
  };
  const edgeElement = createElement(["canvas-line-group"]);
  const otherEdgeElement = createElement(["canvas-line-group"]);
  const selectedEdge = {
    ...createEdge("inside", "a", "a"),
    lineGroupEl: edgeElement,
  };
  const otherEdge = {
    ...createEdge("outside", "a", "b"),
    lineGroupEl: otherEdgeElement,
  };
  const rootElement = createElement();
  const wrapperElement = createElement();
  const canvas = {
    selection: new Set([selectedNode]),
    nodes: new Map([
      [selectedNode.id, selectedNode],
      [otherNode.id, otherNode],
    ]),
    edges: new Map([
      [selectedEdge.id, selectedEdge],
      [otherEdge.id, otherEdge],
    ]),
    screenshotting: false,
    canvasEl: rootElement,
    wrapperEl: wrapperElement,
    requestFrame: () => undefined,
  };
  let options: {
    width?: number;
    height?: number;
    pixelRatio?: number;
    style?: Partial<CSSStyleDeclaration>;
    filter?: (node: HTMLElement) => boolean;
  } | undefined;
  const renderer = new HtmlToImageCardRenderer(async (_node, renderOptions) => {
    options = renderOptions;
    return new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  });
  const bounds = calculateCardImageExportBounds([selectedNode], 24);

  const result = await renderer.render(
    canvas as never,
    { nodes: [selectedNode], edges: [selectedEdge], bounds },
    { pixelRatio: 2 },
  );

  assert.equal(result.byteLength, 3);
  assert.equal(options?.width, 128);
  assert.equal(options?.height, 108);
  assert.equal(options?.pixelRatio, 2);
  assert.equal(options?.style?.transform, "translate(124px, 4px)");
  assert.equal(options?.filter?.(selectedElement), true);
  assert.equal(options?.filter?.(otherElement), false);
  assert.equal(options?.filter?.(edgeElement), true);
  assert.equal(options?.filter?.(otherEdgeElement), false);
  assert.equal(options?.filter?.(createElement([], "IMG")), false);
});

test("渲染器等待 Canvas 挂载文本内容后再生成图片", async () => {
  const {
    HtmlToImageCardRenderer,
    calculateCardImageExportBounds,
  } = await import("../src/services/CardImageExportService");
  const node = {
    ...createNode("a"),
    nodeEl: createElement(["canvas-node"]),
    initialized: true,
    isContentMounted: false,
  };
  let animationFrames = 0;
  const rootElement = createElement() as HTMLElement & {
    ownerDocument: Document;
  };
  const wrapperElement = createElement();
  rootElement.ownerDocument = {
    defaultView: {
      requestAnimationFrame(callback: FrameRequestCallback) {
        animationFrames += 1;
        if (animationFrames === 3) {
          node.isContentMounted = true;
        }
        callback(animationFrames);
        return animationFrames;
      },
      getComputedStyle: () => ({
        getPropertyValue: () => "#fff",
        backgroundColor: "#fff",
      }),
    },
  } as never;
  const canvas = {
    selection: new Set([node]),
    nodes: new Map([[node.id, node]]),
    screenshotting: false,
    canvasEl: rootElement,
    wrapperEl: wrapperElement,
    requestFrame: () => undefined,
    virtualize: () => undefined,
    getData: () => ({ nodes: [], edges: [] }),
    setData: () => undefined,
    requestSave: () => undefined,
  };
  const renderer = new HtmlToImageCardRenderer(async () => {
    assert.equal(node.isContentMounted, true);
    return new Blob([new Uint8Array([1])], { type: "image/png" });
  });

  await renderer.render(
    canvas as never,
    {
      nodes: [node],
      edges: [],
      bounds: calculateCardImageExportBounds([node], 24),
    },
    { pixelRatio: 2 },
  );

  assert.equal(animationFrames, 3);
});

test("导出服务组合文本卡片、内部连线并以受限 2 倍分辨率保存 PNG", async () => {
  const { CardImageExportService } = await import(
    "../src/services/CardImageExportService"
  );
  const firstNode = {
    ...createNode("a", { x: 0, y: 0 }),
    nodeEl: createElement(["canvas-node"]),
  };
  const secondNode = {
    ...createNode("b", { x: 150, y: 0 }),
    nodeEl: createElement(["canvas-node"]),
  };
  const fileNode = createNode("file", { type: "file", file: "note.md" });
  const internalEdge = createEdge("inside", "a", "b");
  const externalEdge = createEdge("outside", "b", "file");
  const canvas = {
    selection: new Set([firstNode, secondNode, fileNode]),
    nodes: new Map([
      [firstNode.id, firstNode],
      [secondNode.id, secondNode],
      [fileNode.id, fileNode],
    ]),
    edges: new Map([
      [internalEdge.id, internalEdge],
      [externalEdge.id, externalEdge],
    ]),
    canvasEl: createElement(),
    wrapperEl: createElement(),
    getData: () => ({ nodes: [], edges: [] }),
    setData: () => undefined,
    requestSave: () => undefined,
  };
  let renderedTarget:
    | { nodes: CanvasNode[]; edges: CanvasEdge[]; bounds: { width: number; height: number } }
    | undefined;
  let renderedPixelRatio: number | undefined;
  const renderer = {
    async render(
      _canvas: unknown,
      target: typeof renderedTarget,
      options: { pixelRatio: number },
    ) {
      renderedTarget = target;
      renderedPixelRatio = options.pixelRatio;
      return new Uint8Array([1, 2, 3]).buffer;
    },
  };
  let savedCount = 0;
  let savedBytes = 0;
  const savedFile = { path: "folder/Board-selection-2.png" };
  const vaultAdapter = {
    createMergedDocument: async () => savedFile,
    async createCardImage(data: ArrayBuffer, _file: unknown, nodeCount: number) {
      savedCount = nodeCount;
      savedBytes = data.byteLength;
      return savedFile;
    },
  };
  const service = new CardImageExportService(canvas as never, renderer as never, vaultAdapter as never);

  const result = await service.exportSelection(
    [firstNode, secondNode, fileNode],
    { basename: "Board", extension: "canvas" } as never,
  );

  assert.deepEqual(
    renderedTarget?.nodes.map((node) => node.id),
    ["a", "b"],
  );
  assert.deepEqual(
    renderedTarget?.edges.map((edge) => edge.id),
    ["inside"],
  );
  assert.equal(renderedPixelRatio, 2);
  assert.equal(savedCount, 2);
  assert.equal(savedBytes, 3);
  assert.equal(result.file, savedFile);
  assert.equal(result.nodeCount, 2);
});

test("导出服务拒绝无法枚举全部 Canvas 节点的运行时", async () => {
  const { CardImageExportError, CardImageExportService } = await import(
    "../src/services/CardImageExportService"
  );
  const node = {
    ...createNode("a"),
    nodeEl: createElement(["canvas-node"]),
  };
  const service = new CardImageExportService(
    {
      selection: new Set([node]),
      canvasEl: createElement(),
      wrapperEl: createElement(),
      getData: () => ({ nodes: [], edges: [] }),
      setData: () => undefined,
      requestSave: () => undefined,
    } as never,
    { render: async () => new ArrayBuffer(0) },
    { createCardImage: async () => ({ path: "unused.png" }) } as never,
  );

  await assert.rejects(
    service.exportSelection([node], { extension: "canvas" } as never),
    (error: unknown) =>
      error instanceof CardImageExportError
      && error.code === "unsupported-canvas-runtime",
  );
});

test("导出服务拒绝正在编辑的卡片", async () => {
  const { CardImageExportError, CardImageExportService } = await import(
    "../src/services/CardImageExportService"
  );
  const editingNode = {
    ...createNode("editing"),
    isEditing: true,
    nodeEl: createElement(["canvas-node"]),
  };
  const canvas = {
    selection: new Set([editingNode]),
    canvasEl: createElement(),
    wrapperEl: createElement(),
    getData: () => ({ nodes: [], edges: [] }),
    setData: () => undefined,
    requestSave: () => undefined,
  };
  const service = new CardImageExportService(
    canvas as never,
    { render: async () => new ArrayBuffer(0) },
    {
      createMergedDocument: async () => ({ path: "unused.md" }),
      createCardImage: async () => ({ path: "unused.png" }),
    } as never,
  );

  await assert.rejects(
    service.exportSelection([editingNode], { extension: "canvas" } as never),
    (error: unknown) =>
      error instanceof CardImageExportError && error.code === "editing-card",
  );
});
