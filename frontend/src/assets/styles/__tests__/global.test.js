import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
/**
 * @description ダブルタップ拡大の抑止（touch-action: manipulation）の宣言テスト。
 * jsdom ではダブルタップ拡大そのものは確かめられないため、宣言の有無と範囲だけを確かめる。
 */
const read = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');
const globalCss = read('src/assets/styles/global.css');
/** CSS 文字列から、セレクタ＋宣言ブロックの組を取り出す（コメントは除く） */
const toBlocks = (css) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    // 先頭のブロックは scoped> などの直前の文字を含むため、最後の行だけをセレクタとする
    selector: m[1].trim().split('\n').pop().trim(),
    body: m[2],
  }));
/** Vue の <style scoped> 部分だけを返す */
const styleOf = (relativePath) => read(relativePath).split('<style')[1] ?? '';
const withManipulation = (css) => toBlocks(css).filter((b) => /touch-action:\s*manipulation/.test(b.body));
const hasBlock = (css, selector) => withManipulation(css).some((b) => b.selector === selector);

const files = {
  toast: 'src/components/base/BaseToast.vue',
  banner: 'src/components/feature/route/RouteNextSpotBanner.vue',
  navigation: 'src/views/RouteNavigationView.vue',
  form: 'src/components/feature/review/ReviewPostForm.vue',
  viewer: 'src/components/feature/review/ReviewPhotoViewer.vue',
  map: 'src/components/feature/route/RouteMap.vue',
  preview: 'src/components/feature/route/RouteMapPreview.vue',
  navigationMap: 'src/components/feature/route/RouteNavigationMap.vue',
};

describe('ダブルタップ拡大の抑止', () => {
  test('共通ルールが操作用の要素に touch-action: manipulation を当てる', () => {
    const common = withManipulation(globalCss).find((b) => b.selector.startsWith(':where('));
    expect(common).toBeDefined();
    for (const tag of ['button', 'a', 'input', 'textarea', 'select', 'label']) {
      expect(common.selector).toMatch(new RegExp(`\\b${tag}\\b`));
    }
  });

  test('共通ルールは地図の canvas コンテナの中を除外している', () => {
    const common = withManipulation(globalCss).find((b) => b.selector.startsWith(':where('));
    expect(common.selector).toContain(':not(.maplibregl-canvas-container *)');
  });

  test('非ボタンの重なり部品が個別に manipulation を持つ', () => {
    expect(hasBlock(globalCss, '.popup')).toBe(true);
    expect(hasBlock(globalCss, '.bottom-actions')).toBe(true);
    expect(hasBlock(styleOf(files.toast), '.toast')).toBe(true);
    expect(hasBlock(styleOf(files.banner), '.next-spot-banner')).toBe(true);
    expect(hasBlock(styleOf(files.navigation), '.review-toggles')).toBe(true);
    expect(hasBlock(styleOf(files.form), '.review-form')).toBe(true);
  });

  test('地図まわりのコンポーネントには manipulation を付けない', () => {
    for (const key of ['map', 'preview', 'navigationMap']) {
      expect(withManipulation(styleOf(files[key]))).toEqual([]);
    }
    for (const b of withManipulation(globalCss).filter((x) => !x.selector.startsWith(':where('))) {
      expect(b.selector).not.toMatch(/map|canvas/i);
    }
  });

  test('スワイプ用の touch-action: none を保ち、同じブロックに manipulation を混ぜない', () => {
    const handle = toBlocks(styleOf(files.form)).find((b) => b.selector === '.review-form-handle');
    const viewer = toBlocks(styleOf(files.viewer)).find((b) => b.selector === '.photo-viewer');
    expect(handle.body).toMatch(/touch-action:\s*none/);
    expect(viewer.body).toMatch(/touch-action:\s*none/);
    expect(handle.body).not.toMatch(/manipulation/);
    expect(viewer.body).not.toMatch(/manipulation/);
    expect(globalCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/touch-action:\s*none/);
  });

  test('ピンチ拡大を止める指定を足していない', () => {
    for (const css of [globalCss, ...Object.values(files).map(styleOf)]) {
      expect(css).not.toMatch(/touch-action:\s*(pan-x|pan-y|pinch-zoom)\s*;/);
    }
  });

  test('viewport は拡大を禁止していない', () => {
    const html = read('index.html');
    const viewport = html.match(/<meta[^>]*name="viewport"[^>]*>/)[0];
    expect(viewport).not.toMatch(/user-scalable|maximum-scale|minimum-scale/);
    expect(viewport).toContain('width=device-width, initial-scale=1.0');
  });
});
