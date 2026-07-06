// 构建：先生成语料数据，tsc 产出 ESM + d.ts，落 data，再修 ESM 导入
import { execSync } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
execSync('node scripts/gen-data.mjs', { cwd: root, stdio: 'inherit' });
execSync('npx tsc -p tsconfig.build.json', { cwd: root, stdio: 'inherit' });
cpSync(path.join(root, 'src/data'), path.join(dist, 'data'), { recursive: true });

// tsc（moduleResolution:bundler）产出的相对 import 无扩展名、JSON 无导入属性，
// Node 原生 ESM 无法加载。后处理令 dist 可被纯 Node / vitest 直接消费。
fixEsmImports(dist);
console.log('build ok: dist/');

/** 递归修正 dist 内 .js 的 ESM 导入：相对导入补 .js，JSON 导入补 import attribute */
function fixEsmImports(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      fixEsmImports(full);
      continue;
    }
    if (!name.endsWith('.js')) continue;
    let code = readFileSync(full, 'utf8');
    code = code.replace(
      /(\bfrom\s*)(['"])(\.\.?\/[^'"]+)(['"])/g,
      (m, kw, q1, spec, q2) =>
        /\.(js|json|mjs|cjs)$/.test(spec) ? m : `${kw}${q1}${spec}.js${q2}`,
    );
    // 动态导入（按书分包的载荷模块）同样补扩展名
    code = code.replace(
      /(\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)(['"])/g,
      (m, kw, q1, spec, q2) =>
        /\.(js|json|mjs|cjs)$/.test(spec) ? m : `${kw}${q1}${spec}.js${q2}`,
    );
    code = code.replace(
      /(\bfrom\s*)(['"])(\.\.?\/[^'"]+\.json)(['"])(?!\s*with)/g,
      (m, kw, q1, spec, q2) => `${kw}${q1}${spec}${q2} with { type: 'json' }`,
    );
    writeFileSync(full, code);
  }
}
