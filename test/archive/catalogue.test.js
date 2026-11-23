import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogue, holdings, renderHoldingPage, renderHoldingRow } from "../../scripts/holdings.mjs";

test("each historical record has its own page and original catalogue link", () => {
  assert.equal(new Set(holdings.map(record => record.slug)).size, holdings.length);
  for (const record of holdings) {
    assert.ok(record.sources.length, record.slug);
    assert.ok(renderHoldingRow(record).includes(`href="/records/${record.slug}/"`));
    assert.ok(renderHoldingPage(record).includes(new URL(record.sources[0][1]).origin));
  }
  const sleeve = catalogue.find(record => record.reference === "HO/78/017");
  assert.match(renderHoldingRow(sleeve), /data-record="HO\/78\/017" data-reference-only hidden/);
});

test("record images ship locally with a caption, source credit and rights statement", async () => {
  for (const record of holdings.filter(record => record.image)) {
    const { image } = record;
    const page = renderHoldingPage(record);
    const file = await readFile(new URL(`../../archive${image.src}`, import.meta.url));
    assert.equal(file.toString("ascii", 8, 12), "WEBP", image.src);
    assert.ok(image.alt && image.caption && image.credit && image.licence, record.slug);
    assert.ok(page.includes(`width="${image.width}" height="${image.height}"`), record.slug);
    assert.ok(page.includes(new URL(image.source).hostname), record.slug);
  }
});

test("the ferry catalogue PDF and shawm audio are marked as files", () => {
  for (const [slug, format] of [["gosport-ticket-office", "PDF"], ["mary-rose-shawm", "MP3"]]) {
    const page = renderHoldingPage(holdings.find(record => record.slug === slug));
    assert.match(page, new RegExp(`class="govuk-link file-link"[^>]*>[^<]+\\(${format}\\)</a>`));
  }
  const print = holdings.find(record => record.slug === "portsmouth-point");
  assert.doesNotMatch(renderHoldingPage(print), /file-link/);
});
