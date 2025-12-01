#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const rushPath = path.join(repoRoot, 'rush.json');

function readRush() {
  return JSON.parse(fs.readFileSync(rushPath, 'utf8'));
}

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (
      ['node_modules', 'dist', 'build', '.git', 'coverage', 'out'].includes(
        e.name,
      )
    )
      continue;
    if (e.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

function countLines(dir) {
  const exts = [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.go',
    '.java',
    '.py',
    '.rs',
    '.cpp',
    '.c',
    '.h',
    '.cs',
    '.php',
    '.rb',
    '.swift',
    '.kt',
    '.kts',
    '.scala',
    '.lua',
    '.sh',
    '.html',
    '.css',
    '.scss',
    '.json',
    '.yaml',
    '.yml',
    '.xml',
  ];
  let lines = 0;
  try {
    walk(dir, file => {
      const ext = path.extname(file).toLowerCase();
      if (!exts.includes(ext)) return;
      try {
        const content = fs.readFileSync(file, 'utf8');
        lines += content.split(/\r?\n/).length;
      } catch (e) {
        console.warn('Failed to read file:', file, e.message);
      }
    });
  } catch (e) {
    console.warn('Failed to walk directory:', dir, e.message);
  }
  return lines;
}

function categorize(lines) {
  if (lines <= 300) return '微';
  if (lines <= 1000) return '小';
  if (lines <= 10000) return '中';
  if (lines <= 50000) return '大';
  return '巨大';
}

function processProject(project) {
  const folder = path.join(repoRoot, project.projectFolder);
  if (!fs.existsSync(folder)) return { ok: false, reason: 'no-folder' };
  const lines = countLines(folder);
  const category = categorize(lines);

  return { ok: true, lines, category };
}

function main() {
  const rush = readRush();
  const projects = rush.projects || [];
  const results = [];
  for (const p of projects) {
    try {
      const r = processProject(p);
      results.push({ project: p.packageName, folder: p.projectFolder, ...r });
    } catch (e) {
      results.push({
        project: p.packageName,
        folder: p.projectFolder,
        ok: false,
        reason: e.message,
      });
    }
  }
  const tmpDir = path.join(repoRoot, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const jsonOut = path.join(tmpDir, 'sub-pkg-scale-report.json');
  fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));

  const csvOut = path.join(tmpDir, 'sub-pkg-scale-report.csv');
  fs.writeFileSync(csvOut, resultsToCsv(results));

  console.log('Done. JSON report at', jsonOut);
  console.log('Done. CSV report at', csvOut);
}

function escapeCsv(value) {
  if (value === undefined) return '';
  const str = `${value}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function resultsToCsv(results) {
  const headers = ['project', 'folder', 'ok', 'lines', 'category', 'reason'];
  const rows = [headers.join(',')];
  for (const r of results) {
    const row = headers
      .map(key => escapeCsv(r[key]))
      .join(',');
    rows.push(row);
  }
  return rows.join('\n');
}

main();
