import * as assert from "node:assert/strict";
import test from "node:test";

test("图片导出将非 data URL 资源替换为本地透明占位", async () => {
  const { resourceToDataURL } = await import(
    "../src/utils/htmlToImageLocalResources"
  );
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("network access is not allowed");
  };

  try {
    const result = await resourceToDataURL(
      "https://example.com/background.png",
      "image/png",
      {},
    );

    assert.match(result, /^data:image\/gif;base64,/);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("图片导出保留已有 data URL", async () => {
  const { resourceToDataURL } = await import(
    "../src/utils/htmlToImageLocalResources"
  );
  const dataUrl = "data:image/png;base64,AA==";

  assert.equal(await resourceToDataURL(dataUrl, "image/png", {}), dataUrl);
});

test("图片导出跳过网页字体收集与嵌入", async () => {
  const { embedWebFonts, getWebFontCSS } = await import(
    "../src/utils/htmlToImageLocalFonts"
  );

  assert.equal(await getWebFontCSS(), "");
  assert.equal(await embedWebFonts(), undefined);
});
