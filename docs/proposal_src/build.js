const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, ImageRun, PageBreak, LevelFormat, TabStopType, LeaderType, Tab, Footer,
  PageNumber, BorderStyle, VerticalAlign,
} = require("docx");
const C = require("./content.js");

const FONT = "Times New Roman";
const CONTENT_W = 9026; // A4 width 11906 minus 2 x 1440 margins
const toc = fs.existsSync("toc.json") ? JSON.parse(fs.readFileSync("toc.json", "utf8")) : {};

// --- inline markup: **bold**, _italic_ -------------------------------------------------------
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ ...base, bold: true, text: tok.slice(2, -2) }));
    else out.push(new TextRun({ ...base, italics: true, text: tok.slice(1, -1) }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ ...base, text: text.slice(last) }));
  return out;
}

const P = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.JUSTIFIED,
  spacing: { after: opts.after ?? 120, line: 264 },
  ...(opts.numbering ? { numbering: opts.numbering } : {}),
  children: runs(text, opts.run || {}),
});

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function figure({ file, caption, widthIn }) {
  const data = fs.readFileSync(file);
  const { w, h } = pngSize(data);
  const width = Math.round(widthIn * 96);
  const height = Math.round(width * h / w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
      children: [new ImageRun({ type: "png", data, transformation: { width, height } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 20 })],
    }),
  ];
}

function cell(text, { width, header = false, center = false }) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    shading: header ? { fill: "D9E2F3", type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 0, line: 240 },
      children: runs(text, { size: 21, bold: header }),
    })],
  });
}

function table(t) {
  const centerSet = new Set(t.centerCols || []);
  const isCenter = (ci) => centerSet.has(ci) || (t.centerFrom !== undefined && ci >= t.centerFrom);
  const rows = [
    new TableRow({ tableHeader: true, children: t.header.map((h, ci) => cell(h, { width: t.widths[ci], header: true, center: ci > 0 && isCenter(ci) })) }),
    ...t.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, ci) => cell(v, { width: t.widths[ci], center: isCenter(ci) })) })),
  ];
  return [
    new Table({ columnWidths: t.widths, width: { size: t.widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [new TextRun({ text: t.caption, italics: true, size: 20 })] }),
  ];
}

function block(b) {
  if (b.p) return [P(b.p)];
  if (b.h2) return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: b.h2, bold: true })] })];
  if (b.h3) return [new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: b.h3, bold: true })] })];
  if (b.bullets) return b.bullets.map((t) => P(t, { numbering: { reference: "bullets", level: 0 }, after: 80 }));
  if (b.numbered) return b.numbered.map((t) => P(t, { numbering: { reference: "objectives", level: 0 }, after: 80 }));
  if (b.refs) return b.refs.map((t) => P(t, { numbering: { reference: "refs", level: 0 }, after: 80, align: AlignmentType.LEFT }));
  if (b.figure) return figure(b.figure);
  if (b.table) return table(b.table);
  throw new Error("unknown block " + JSON.stringify(b).slice(0, 60));
}

// --- front matter ------------------------------------------------------------------------------
const centered = (text, { size = 24, bold = false, after = 0, before = 0 } = {}) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after, before, line: 276 },
  children: [new TextRun({ text, size, bold })],
});

const logo = fs.readFileSync("figures/p01_x13.png");
const titlePage = [
  new Paragraph({ spacing: { before: 600 } }),
  centered(C.title, { size: 32, bold: true, after: 120 }),
  centered(C.subtitle, { size: 24, bold: true, after: 500 }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new ImageRun({ type: "png", data: logo, transformation: { width: 180, height: Math.round(180 * 309 / 365) } })] }),
  centered(C.session, { bold: true, after: 240 }),
  ...C.supervisorLines.map((l, i) => centered(l, { bold: true, after: i === C.supervisorLines.length - 1 ? 240 : 0 })),
  centered("Submitted By", { bold: true, after: 60 }),
  ...C.submittedBy.map((s) => new Paragraph({ numbering: { reference: "submitted", level: 0 }, indent: { left: 4000, hanging: 420 }, spacing: { after: 0 }, children: [new TextRun({ text: s })] })),
  new Paragraph({ spacing: { before: 700 } }),
  ...C.deptLines.map((l) => centered(l, { size: 28, bold: true })),
  new Paragraph({ spacing: { before: 500 } }),
  centered(C.date),
];

const sigCell = (name) => new TableCell({
  width: { size: CONTENT_W / 2, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
  children: [
    new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun("Signature: _______________")] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun(`Name: ${name}`)] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun(`Date: ${C.date}`)] }),
  ],
});
const declaration = [
  centered("Declaration", { size: 28, bold: true, after: 300 }),
  P(C.declaration, { after: 360 }),
  new Paragraph({ spacing: { after: 360 }, children: [new TextRun("Submission Date: _______________")] }),
  new Table({
    columnWidths: [CONTENT_W / 2, CONTENT_W / 2], width: { size: CONTENT_W, type: WidthType.DXA },
    borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, insideHorizontal: { style: BorderStyle.NONE, size: 0 }, insideVertical: { style: BorderStyle.NONE, size: 0 } },
    rows: C.signatories.map((pair) => new TableRow({ children: pair.map(sigCell) })),
  }),
];

const tocPage = [
  centered("Table of Contents", { size: 28, bold: true, after: 300 }),
  ...C.toc.map((title, i) => new Paragraph({
    tabStops: [{ type: TabStopType.LEFT, position: 720 }, { type: TabStopType.RIGHT, position: CONTENT_W, leader: LeaderType.DOT }],
    spacing: { after: 160 },
    children: [new TextRun({ bold: true, children: [`${i + 1}`, new Tab(), title] }), new TextRun({ children: [new Tab(), String(toc[title] ?? "?")] })],
  })),
];

// --- body --------------------------------------------------------------------------------------
const body = [];
C.sections.forEach((s, i) => {
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: i === 0, children: [new TextRun({ text: s.h1, bold: true })] }));
  s.blocks.forEach((b) => body.push(...block(b)));
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const margins = { top: 1440, bottom: 1440, left: 1440, right: 1440 };
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT] })] })] });

const doc = new Document({
  creator: "IntelliClass AI FYP Group",
  title: "Keeping Students Focused Online – FYP Proposal",
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 28, bold: true, color: "000000" }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, color: "000000" }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, color: "000000" }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "objectives", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 400 } } } }] },
      { reference: "refs", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "[%1]", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 720 } } } }] },
      { reference: "submitted", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT }] },
    ],
  },
  sections: [
    { properties: { page: { margin: margins } }, children: titlePage },
    { properties: { page: { margin: margins, pageNumbers: { start: 2 } } }, footers: { default: footer },
      children: [...declaration, pageBreak(), ...tocPage, ...body] },
  ],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync("proposal.docx", buf); console.log("wrote proposal.docx", buf.length, "bytes"); });
