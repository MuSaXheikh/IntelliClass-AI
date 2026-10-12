# Proposal source (revised wording, October 2026)

`content.js` holds the proposal text; `build.js` renders it to Word with the `docx` npm package.

```bash
cd docs/proposal_src
npm install docx@9            # once
node build.js                 # writes proposal.docx (uses toc.json for contents-page numbers)
soffice --headless --convert-to pdf proposal.docx
```

If headings move to different pages, update `toc.json` and run `node build.js` again.
`stylo.py` prints the sentence-rhythm and stock-phrase profile used to compare versions.
Figures are the originals extracted from the submitted PDF; references are unchanged.
