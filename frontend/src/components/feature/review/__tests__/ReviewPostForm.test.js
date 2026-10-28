import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import ReviewPostForm from '@/components/feature/review/ReviewPostForm.vue';

/**
 * @description 投稿ボタンが、投稿中であることを文言で伝えるかを確かめるテスト。
 * 画面全体の「投稿中…」とは別に、押したボタン自体でも分かるようにしている。
 */

/**
 * @description 投稿フォームを描画する
 * @param {object} [props] 上書きする props
 * @returns {object} マウントした wrapper
 */
const mountForm = (props = {}) =>
  mount(ReviewPostForm, {
    props: {
      genreOptions: [],
      ...props
    }
  });

/**
 * @description 投稿ボタンを探す
 * @param {object} wrapper マウントした wrapper
 * @returns {object} 投稿ボタン
 */
const findSubmitButton = (wrapper) => wrapper.find('.review-submit');

describe('ReviewPostForm の投稿ボタン', () => {
  test('投稿中でなければ「投稿」と出し、押せる', () => {
    const button = findSubmitButton(mountForm());

    expect(button.text()).toBe('投稿');
    expect(button.attributes('disabled')).toBeUndefined();
  });

  test('投稿中は「投稿中…」と出し、押せなくする', () => {
    const button = findSubmitButton(mountForm({ isPosting: true }));

    expect(button.text()).toBe('投稿中…');
    expect(button.attributes('disabled')).toBeDefined();
  });
});
