import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import RouteNextSpotBanner from '@/components/feature/route/RouteNextSpotBanner.vue';

/**
 * @description 案内中の次の目的地バナーのテスト。
 * 目的地の名前を省略せず全文出すこと、置き場所を親に任せていること（固定配置を持たない）を確かめる。
 * jsdom はレイアウトを計算しないため、見た目の省略はスタイルの宣言で確かめる。
 */

/** バナーの <style scoped> 部分（コメントを除く） */
const bannerStyle = readFileSync(
  resolve(process.cwd(), 'src/components/feature/route/RouteNextSpotBanner.vue'),
  'utf8'
)
  .split('<style')[1]
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * @description セレクタの宣言ブロックの中身を返す（メディアクエリの中も含めてすべて連結する）
 * @param {string} selector セレクタ
 * @returns {string} 宣言の中身
 */
const declarationsOf = (selector) =>
  [...bannerStyle.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].trim().split('\n').pop().trim() === selector)
    .map((match) => match[2])
    .join('\n');

/** 省略表示（…・行数制限）に関わる宣言 */
const TRUNCATION_PATTERN = /line-clamp|text-overflow|overflow:\s*hidden|white-space:\s*nowrap|max-height/;

describe('RouteNextSpotBanner', () => {
  test('長い目的地の名前も、全文をそのまま表示する', () => {
    const longName = '国指定重要文化財 旧〇〇家住宅と庭園（東京都千代田区大手町一丁目）';
    const wrapper = mount(RouteNextSpotBanner, {
      props: { spotName: longName, distanceToNextM: 320 }
    });

    expect(wrapper.find('.banner-name').text()).toBe(longName);
  });

  test('目的地の名前に省略表示の指定を持たせず、枠の中で折り返す', () => {
    const nameDeclarations = declarationsOf('.banner-name');

    expect(nameDeclarations).not.toBe('');
    expect(nameDeclarations).not.toMatch(TRUNCATION_PATTERN);
    expect(nameDeclarations).toMatch(/overflow-wrap:\s*anywhere/);
  });

  test('帯は画面へ固定せず、親の幅いっぱいに広がる（下のボタンと重ねないため）', () => {
    const bannerDeclarations = declarationsOf('.next-spot-banner');

    expect(bannerDeclarations).not.toMatch(/position:\s*fixed/);
    expect(bannerDeclarations).toMatch(/width:\s*100%/);
  });
});
