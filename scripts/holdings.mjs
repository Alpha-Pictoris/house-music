import { caseFiles } from "./holdings/case-files.mjs";
import { civicHoldings } from "./holdings/civic.mjs";
import { cultureHoldings } from "./holdings/culture.mjs";
import { harbourHoldings } from "./holdings/harbour.mjs";
import { localStudies } from "./holdings/local-studies.mjs";
import { wartimeHoldings } from "./holdings/wartime.mjs";

export const holdings = [...localStudies, ...civicHoldings, ...cultureHoldings, ...harbourHoldings, ...wartimeHoldings];
export const catalogue = [...holdings, ...caseFiles].sort((a, b) => a.title.localeCompare(b.title, "en-GB"));

function escapeHTML(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderHoldingRow(record) {
  const terms = [record.reference, record.search].filter(Boolean).join(" ");
  const href = record.href ?? `/records/${record.slug}/`;
  return `<tr class="govuk-table__row" data-record="${escapeHTML(terms)}"${record.referenceOnly ? " data-reference-only hidden" : ""}>
    <td class="govuk-table__cell"><a class="govuk-link" href="${escapeHTML(href)}">${escapeHTML(record.title)}</a><p class="govuk-body-s record-description">${escapeHTML(record.description)}</p></td>
    <td class="govuk-table__cell"><span class="catalogue-ref">${escapeHTML(record.reference ?? "—")}</span></td>
    <td class="govuk-table__cell">${escapeHTML(record.year)}</td>
  </tr>`;
}

function sourceLink(label, url, format) {
  const text = format ? `${label} (${format})` : label;
  return `<a class="govuk-link${format ? " file-link" : ""}" href="${escapeHTML(url)}">${escapeHTML(text)}</a>`;
}

function renderFigure(image) {
  const credit = sourceLink(image.credit, image.source);
  const rights = image.licenceURL ? sourceLink(image.licence, image.licenceURL) : escapeHTML(image.licence);
  return `<figure class="record-image">
    <img src="${escapeHTML(image.src)}" width="${image.width}" height="${image.height}" alt="${escapeHTML(image.alt)}">
    <figcaption>${escapeHTML(image.caption)}<span class="image-credit">${credit} · ${rights}</span></figcaption>
  </figure>`;
}

function renderTable({ caption, headings, rows }) {
  const columns = headings.map(heading => `<th class="govuk-table__header" scope="col">${escapeHTML(heading)}</th>`);
  const entries = rows.map(([label, ...values]) => {
    const cells = values.map(value => `<td class="govuk-table__cell">${escapeHTML(value)}</td>`);
    return `<tr class="govuk-table__row"><th class="govuk-table__header" scope="row">${escapeHTML(label)}</th>${cells.join("")}</tr>`;
  });
  return `<table class="govuk-table">
    <caption class="govuk-table__caption govuk-table__caption--m">${escapeHTML(caption)}</caption>
    <thead class="govuk-table__head"><tr class="govuk-table__row">${columns.join("")}</tr></thead>
    <tbody class="govuk-table__body">${entries.join("\n")}</tbody>
  </table>`;
}

export function renderHoldingPage(record) {
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHTML(record.title)} · Portsmouth City Record Office</title>
  <link rel="icon" href="/assets/office-mark.svg" type="image/svg+xml">
  <meta name="theme-color" content="#142e3a">
  <link rel="stylesheet" href="/govuk.css">
  <link rel="stylesheet" href="/archive.css">
</head>
<body>
<!-- archive-header -->
<nav class="govuk-width-container govuk-breadcrumbs" aria-label="Breadcrumb">
  <ol class="govuk-breadcrumbs__list"><li class="govuk-breadcrumbs__list-item"><a class="govuk-breadcrumbs__link" href="/">Catalogue</a></li></ol>
</nav>
<main id="main" tabindex="-1" class="govuk-width-container reading record-page">
  <h1 class="govuk-heading-xl">${escapeHTML(record.title)}</h1>
  <p class="govuk-body-s file-ref">${escapeHTML(record.kind)}${record.reference ? ` &nbsp; / &nbsp; ${escapeHTML(record.reference)}` : ""}</p>
  <p class="govuk-body-l record-lead">${escapeHTML(record.description)}</p>
  <p class="govuk-body">${escapeHTML(record.date)}</p>
  ${record.image ? renderFigure(record.image) : ""}
  <h2 class="govuk-heading-m">${escapeHTML(record.heading)}</h2>
  ${record.paragraphs.map(line => `<p class="govuk-body">${escapeHTML(line)}</p>`).join("\n  ")}
  ${record.table ? renderTable(record.table) : ""}
  <h2 class="govuk-heading-m">Catalogue sources</h2>
  <ul class="govuk-list">
    ${record.sources.map(([label, url, format]) => `<li>${sourceLink(label, url, format)}</li>`).join("\n    ")}
  </ul>
</main>
<!-- archive-footer -->
</body>
</html>
`;
}
