import * as assert from "node:assert/strict";
import { resolve } from "node:path";
import type { MergeWorkbenchContext } from "../src/presentation/views";
import type { CardSnapshot, WorkbenchState } from "../src/types/WorkbenchState";

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

const snapshots: CardSnapshot[] = [
  {
    id: "first",
    text: "first",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  },
  {
    id: "second",
    text: "second",
    x: 100,
    y: 0,
    width: 100,
    height: 50,
  },
];

function state(cardSeparator: string | null): WorkbenchState {
  return {
    canvasFilePath: "test.canvas",
    canvasFileBasename: "test",
    scopeLabel: "selection",
    selectionSnapshot: snapshots,
    sortMode: "position",
    manualOrderIds: [],
    isManualAdjusted: false,
    previewExpanded: false,
    lastComputedContent: "",
    cardSeparator,
  };
}

void (async () => {
  const { MergeService } = await import("../src/services/MergeService");

  async function createContext(
    initialCardSeparator: string | null,
    getLatestCardSeparator: () => string | null
  ): Promise<{ context: MergeWorkbenchContext; getCreatedCardSeparator: () => string | null | undefined }> {
    let createdCardSeparator: string | null | undefined;
    const service = new MergeService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      getLatestCardSeparator
    );

    service.mergeSnapshotsToCanvasCard = async (_snapshots, _canvasFilePath, options) => {
      createdCardSeparator = options?.cardSeparator;
      return true;
    };

    const context = (service as unknown as {
      createWorkbenchContext(
        workbenchState: WorkbenchState,
        sortPriority: "yx"
      ): MergeWorkbenchContext;
    }).createWorkbenchContext(state(initialCardSeparator), "yx");

    return {
      context,
      getCreatedCardSeparator: () => createdCardSeparator,
    };
  }

  async function testCreateCardUsesSeparatorEnabledAfterWorkbenchOpened(): Promise<void> {
    const fixture = await createContext(null, () => "---");

    await fixture.context.onCreateCard(fixture.context.state);

    assert.equal(fixture.getCreatedCardSeparator(), "---");
  }

  async function testCreateCardUsesSeparatorDisabledAfterWorkbenchOpened(): Promise<void> {
    const fixture = await createContext("---", () => null);

    await fixture.context.onCreateCard(fixture.context.state);

    assert.equal(fixture.getCreatedCardSeparator(), null);
  }

  await testCreateCardUsesSeparatorEnabledAfterWorkbenchOpened();
  await testCreateCardUsesSeparatorDisabledAfterWorkbenchOpened();
  console.log("workbench card separator tests passed");
})();
