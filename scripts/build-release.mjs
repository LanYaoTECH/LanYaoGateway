// 构建便携版发布包（Windows 双击即用）
// 步骤：
//   1. 用 esbuild 把 src 打包为单文件 CJS（外置原生模块 better-sqlite3）
//   2. 下载与当前 Node 版本一致的 Windows x64 便携版（保证原生模块 ABI 匹配）
//   3. 拷贝 better-sqlite3 原生模块、启动脚本、说明文档
//   4. 打包成 zip（可选）
import { build } from 'esbuild';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'release', 'LanYaoGateway');
const RUNTIME_DIR = path.join(RELEASE_DIR, 'runtime');
const NODE_MODULES_DIR = path.join(RELEASE_DIR, 'node_modules');
const CACHE_DIR = path.join(ROOT, '.cache');

const NODE_VERSION = process.versions.node; // 当前 Node 版本（保证与已编译原生模块 ABI 匹配）
const NODE_DIST = `node-v${NODE_VERSION}-win-x64`;
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.zip`;

const log = (...args) => console.log('[build]', ...args);

async function clean() {
  log('清理旧的 release 目录...');
  await fsp.rm(path.join(ROOT, 'release'), { recursive: true, force: true });
  await fsp.mkdir(RELEASE_DIR, { recursive: true });
  await fsp.mkdir(CACHE_DIR, { recursive: true });
}

async function bundleApp() {
  log('使用 esbuild 打包源码 -> release/app.mjs');
  await build({
    entryPoints: [path.join(ROOT, 'src', 'index.ts')],
    outfile: path.join(RELEASE_DIR, 'app.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: `node${NODE_VERSION.split('.')[0]}`,
    external: ['better-sqlite3'], // 原生模块不能 bundle，运行时按目录加载
    minify: true,
    sourcemap: false,
    logLevel: 'info',
    // ESM bundle 中引用 CJS 依赖（如 better-sqlite3）需要 createRequire
    banner: {
      js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
    },
  });
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(destPath);
        return download(res.headers.location, destPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`下载失败 ${res.statusCode}: ${url}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      let lastPct = -1;
      res.on('data', (chunk) => {
        received += chunk.length;
        if (total) {
          const pct = Math.floor((received / total) * 100);
          if (pct !== lastPct && pct % 10 === 0) {
            log(`  下载进度 ${pct}%`);
            lastPct = pct;
          }
        }
      });
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
  });
}

async function fetchPortableNode() {
  const zipPath = path.join(CACHE_DIR, `${NODE_DIST}.zip`);
  if (!fs.existsSync(zipPath)) {
    log(`下载 Node.js 便携版: ${NODE_URL}`);
    await download(NODE_URL, zipPath);
  } else {
    log(`使用已缓存的 Node 便携版: ${zipPath}`);
  }

  log('解压 Node.js 到 runtime/');
  const zip = new AdmZip(zipPath);
  const tmpExtract = path.join(CACHE_DIR, 'node-extract');
  await fsp.rm(tmpExtract, { recursive: true, force: true });
  zip.extractAllTo(tmpExtract, true);
  const innerDir = path.join(tmpExtract, NODE_DIST);
  await fsp.mkdir(RUNTIME_DIR, { recursive: true });
  // 只保留必要文件，减小体积
  const keep = ['node.exe'];
  for (const name of keep) {
    const src = path.join(innerDir, name);
    if (fs.existsSync(src)) {
      await fsp.copyFile(src, path.join(RUNTIME_DIR, name));
    }
  }
  await fsp.rm(tmpExtract, { recursive: true, force: true });
}

async function copyDir(src, dest, filter = () => true) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (!filter(s, entry)) continue;
    if (entry.isDirectory()) {
      await copyDir(s, d, filter);
    } else if (entry.isFile()) {
      await fsp.copyFile(s, d);
    }
  }
}

async function copyBetterSqlite3() {
  log('拷贝 better-sqlite3 原生模块...');
  // 需要包含 bindings、file-uri-to-path 这些运行时依赖
  const requiredModules = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
  for (const mod of requiredModules) {
    const src = path.join(ROOT, 'node_modules', mod);
    const dest = path.join(NODE_MODULES_DIR, mod);
    if (!fs.existsSync(src)) {
      throw new Error(`缺少依赖: ${mod}，请先 npm install`);
    }
    await copyDir(src, dest, (p, entry) => {
      // 跳过测试、文档、源码等无用文件，但保留 build/Release/*.node
      const rel = path.relative(src, p).replace(/\\/g, '/');
      if (rel.startsWith('test') || rel.startsWith('docs')) return false;
      if (entry.isFile() && /\.(md|markdown|map|ts)$/i.test(entry.name)) return false;
      return true;
    });
  }
}

async function writeLauncher() {
  log('写入启动脚本与说明...');

  const bat = `@echo off
title 澜鳐设备网关 LanYaoGateway
cd /d "%~dp0"

echo ============================================================
echo   澜鳐设备网关 LanYaoGateway
echo   服务地址: http://localhost:3210
echo   关闭此窗口即可停止服务
echo ============================================================
echo.

"runtime\\node.exe" "app.mjs"

echo.
echo 服务已退出。按任意键关闭窗口...
pause >nul
`;
  await fsp.writeFile(path.join(RELEASE_DIR, '启动网关.bat'), iconv.encode(bat.replace(/\r?\n/g, '\r\n'), 'gbk'));

  // 静默启动版本（不弹黑窗）
  const vbs = `Set ws = CreateObject("WScript.Shell")
ws.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
ws.Run "runtime\\node.exe app.mjs", 0, False
`;
  // VBS 在中文 Windows 上默认以 ANSI(GBK) 读取
  await fsp.writeFile(path.join(RELEASE_DIR, '后台启动（无窗口）.vbs'), iconv.encode(vbs.replace(/\r?\n/g, '\r\n'), 'gbk'));

  const stop = `@echo off
echo 正在停止占用 3210 端口的网关进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3210" ^| findstr "LISTENING"') do (
  echo 结束 PID %%a
  taskkill /PID %%a /F >nul 2>&1
)
echo 完成。
timeout /t 2 >nul
`;
  await fsp.writeFile(path.join(RELEASE_DIR, '停止网关.bat'), iconv.encode(stop.replace(/\r?\n/g, '\r\n'), 'gbk'));

  const readme = `澜鳐设备网关 LanYaoGateway —— 便携版使用说明
===============================================

【运行】
  双击  启动网关.bat        会弹出控制台窗口，可看日志
  或者双击  后台启动（无窗口）.vbs   静默后台运行

【停止】
  关闭控制台窗口；或运行  停止网关.bat

【访问】
  REST API : http://localhost:3210/api
  WebSocket: ws://localhost:3210/ws
  健康检查 : http://localhost:3210/health

【数据】
  数据库文件位于 data/gateway.db，可备份或迁移。

【自定义端口】
  在  启动网关.bat  中，把
      "runtime\\node.exe" "app.mjs"
  改为
      set PORT=8080 ^&^& "runtime\\node.exe" "app.mjs"

【系统要求】
  Windows 10 / 11 64 位。无需安装 Node.js 或其它依赖。
`;
  await fsp.writeFile(path.join(RELEASE_DIR, '使用说明.txt'), iconv.encode(readme.replace(/\r?\n/g, '\r\n'), 'gbk'));
}

async function makeZip() {
  const zipPath = path.join(ROOT, 'release', `LanYaoGateway-portable-win-x64.zip`);
  log(`打包 zip: ${zipPath}`);
  const zip = new AdmZip();
  zip.addLocalFolder(RELEASE_DIR, 'LanYaoGateway');
  zip.writeZip(zipPath);
  const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
  log(`完成: ${zipPath} (${sizeMB} MB)`);
}

async function main() {
  await clean();
  await bundleApp();
  await fetchPortableNode();
  await copyBetterSqlite3();
  await writeLauncher();
  await makeZip();
  log('全部完成。');
  log(`产物目录: ${RELEASE_DIR}`);
  log('用户使用：解压 zip 后，双击其中的「启动网关.bat」即可运行。');
}

main().catch((err) => {
  console.error('[build] 失败:', err);
  process.exit(1);
});
