/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
    if (['node_modules', 'dist', 'build', '.git', 'coverage', 'out'].includes(e.name)) continue;
    if (e.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

function countLines(dir) {
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.go', '.java', '.py', '.rs'];
  let lines = 0;
  try {
    walk(dir, (file) => {
      const ext = path.extname(file).toLowerCase();
      if (!exts.includes(ext)) return;
      try {
        const content = fs.readFileSync(file, 'utf8');
        lines += content.split(/\r?\n/).length;
      } catch (e) {}
    });
  } catch (e) {}
  return lines;
}

function categorize(lines) {
  if (lines <= 200) return '微';
  if (lines <= 1000) return '小';
  if (lines <= 10000) return '中';
  if (lines <= 50000) return '大';
  return '巨大';
}

function removeBoilerplate(md) {
  // remove common boilerplate sections by heading keywords
  const pattern = /(^#{1,3}\s*(?:贡献|安装|如何运行|运行|Usage|Usage:|License|版权|测试|示例|示范|How to|How to run)[\s\S]*?)(?=^#{1,3}\s|\Z)/gmi;
  return md.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim();
}

function ensureSections(md, category, pkgName) {
  let out = md;
  const hasUse = /#{1,3}\s*(用途|用途说明|Purpose)/i.test(out);
  const hasFlow = /#{1,3}\s*(数据链路|数据流|Data flow|上游|下游)/i.test(out);
  const hasArch = /#{1,3}\s*(架构|Architecture)/i.test(out);

  if (category === '微') {
    if (!hasUse) {
      out = `## 用途\n- 本包：${pkgName} 的核心职责与用途简述。\n\n` + out;
    }
    if (!hasFlow) {
      out += `\n\n## 上下游\n- 上游：简要列出直接依赖的包或接口。\n- 下游：简要列出主要的调用方或集成点。`;
    }
  } else {
    if (!hasArch) {
      out = `## 架构概览\n- 模块划分：列出主要模块/目录与职责。\n- 扩展点：说明插件/适配器/暴露的 API。\n\n` + out;
    }
    if (!hasFlow) {
      out += `\n\n## 关键上下游与数据链路\n- 输入来源：列出关键上游数据/事件来源。\n- 输出去向：列出主要下游消费者与 side effects。\n- 重要转换点：标注会改变数据结构或关键序列化/反序列化的文件/函数。`;
    }
  }
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function processProject(project) {
  const folder = path.join(repoRoot, project.projectFolder);
  const mdPath = path.join(folder, 'copilot-instructions.md');
  if (!fs.existsSync(folder)) return { ok: false, reason: 'no-folder' };
  const lines = countLines(folder);
  const category = categorize(lines);
  if (!fs.existsSync(mdPath)) return { ok: false, reason: 'no-file', lines, category, folder };

  return { ok: true, path: mdPath, lines, category };
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
      results.push({ project: p.packageName, folder: p.projectFolder, ok: false, reason: e.message });
    }
  }
  const out = path.join(repoRoot, '.tmp', 'sub-pkg-scale-report.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('Done. Report at', out);
}

main();
