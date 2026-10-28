/**
 * @description ジャンル（genreId）ごとのアイコン画像を固定で対応づける。
 * 以前はマスタ（getConditions）が返す絵文字（iconEmoji）を表示していたが、
 * 端末・ブラウザで見た目が揃わないため、同梱した画像に固定する。
 * 画像は背景を透過した軽量なPNG（128px）で、他の同梱画像（logo.png 等）と形式を揃えている。
 *
 * キーはマスタのジャンルID（backend の seedConditions.js と一致させる）。
 * 画像のファイル名はジャンルIDと必ずしも一致しない（gourmet → food.png）ため、
 * 対応はこの表で明示する。ジャンルを増やすときは画像を assets/images/genre/ に置き、
 * ここへ1行追加する。
 */

import foodImage from '@/assets/images/genre/food.png';
import historyImage from '@/assets/images/genre/history.png';
import natureImage from '@/assets/images/genre/nature.png';
import photoImage from '@/assets/images/genre/photo.png';

/** ジャンルID → アイコン画像のURL */
export const GENRE_IMAGES = {
  nature: natureImage,
  photo: photoImage,
  history: historyImage,
  gourmet: foodImage
};

/**
 * @description ジャンルIDに対応するアイコン画像を返す。
 * 対応がないジャンルIDのときは null を返し、呼び出し側で画像なしの表示にできるようにする。
 * @param {string} genreId ジャンルID（例: nature）
 * @returns {string|null} 画像のURL。対応がなければ null
 */
export const getGenreImage = (genreId) => GENRE_IMAGES[genreId] ?? null;
