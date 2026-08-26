import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @description 開発用のプロセスをまとめて起動する。
 * ローカルAPIハーネスとViteの開発サーバーを同時に立ち上げる。
 */

/** プロジェクトのルートディレクトリ */
const rootDir = fileURLToPath(new URL('..', import.meta.url));

/** フロントエンド（Vite）のディレクトリ */
const frontendDir = path.join(rootDir, 'frontend');

/** 起動する子プロセスの定義 */
const PROCESS_DEFINITIONS = [
  { label: 'api', scriptPath: path.join(rootDir, 'tools', 'localApiServer.js'), cwd: rootDir },
  { label: 'web', scriptPath: path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js'), cwd: frontendDir }
];

/** 起動済みの子プロセス */
const children = [];

/**
 * @description 起動済みの子プロセスをすべて停止する
 * @returns {void}
 */
const stopAll = () => {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
};

/**
 * @description 子プロセスを起動する
 * @param {object} definition プロセスの定義
 * @param {string} definition.label 表示用のラベル
 * @param {string} definition.scriptPath 実行するスクリプトのパス
 * @param {string} definition.cwd プロセスの作業ディレクトリ
 * @returns {void}
 */
const startProcess = ({ label, scriptPath, cwd }) => {
  const child = spawn(process.execPath, [scriptPath], {
    cwd,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    console.log(`[${label}] プロセスが終了しました（code: ${code}）`);
    stopAll();
    process.exit(code ?? 0);
  });

  children.push(child);
};

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

PROCESS_DEFINITIONS.forEach(startProcess);
