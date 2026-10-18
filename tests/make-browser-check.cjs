// Build a local QA page from the current production HTML; no packages required.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('href="style.css"', 'href="../style.css"')
  // Load while parsing so the test can capture the game before DOMContentLoaded.
  .replace('<script src="game.js" defer></script>', '<script src="../game.js"></script>\n  <script src="browser-check.js"></script>');
fs.writeFileSync(path.join(__dirname, 'browser-check.html'), html);
console.log('Open tests/browser-check.html directly in a browser.');
