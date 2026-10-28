/**
 * @description チュートリアルのステップを定義する。
 * 各ステップは「どの画面で」「マスコットが何を話し」「どの要素を操作させるか」を持つ。
 * 画面側はこの定義を読んで、ハイライトする要素と吹き出しの文言を決める。
 *
 * 一連の流れは次のとおり（画面遷移を含む）。
 * ホーム（ジャンル → 距離 → 作成）→ 提案（決定）→ 案内（次の目的地 → 終了 → 終了確認）
 * → 結果（ホームに戻る）で完了。
 */

/**
 * チュートリアルのステップ名。
 * 画面側が「今どのステップか」を判定するときに、文字列を直書きせずここから参照する。
 */
export const TUTORIAL_STEP = {
  /** ホーム: ジャンルで「写真」を選ばせる */
  SELECT_GENRE: 'select-genre',
  /** ホーム: 距離スライダーを5kmに合わせさせる */
  SELECT_DISTANCE: 'select-distance',
  /** ホーム: 「ルートを作成」を押させる */
  CREATE_ROUTE: 'create-route',
  /** 提案: 「決定」を押させる */
  CONFIRM_ROUTE: 'confirm-route',
  /** 案内: 「次の目的地へ」を押させる */
  ADVANCE_SPOT: 'advance-spot',
  /** 案内: 「みんな」のトグルを押して、他の人の口コミの紫ピンを表示させる */
  SHOW_OTHER_REVIEWS: 'show-other-reviews',
  /** 案内: 地図の紫ピン（他の人の口コミの場所）をタップさせる */
  OPEN_REVIEW: 'open-review',
  /** 案内: 口コミフォームで★の評価を付けさせる */
  RATE_REVIEW: 'rate-review',
  /** 案内: 口コミの「投稿」を押させる（チュートリアルでは送信せずダミー完了） */
  SUBMIT_REVIEW: 'submit-review',
  /** 案内: 地図を長押しして、新しい口コミの場所を登録する流れを体験させる */
  LONG_PRESS_MAP: 'long-press-map',
  /** 案内: 新規投稿フォームにロケーション名・ジャンル・評価を自由入力させる */
  INPUT_NEW_REVIEW: 'input-new-review',
  /** 案内: 新規投稿の「投稿」を押させる（チュートリアルでは送信せず画面上のみ完了） */
  SUBMIT_NEW_REVIEW: 'submit-new-review',
  /** 案内: 「終了」を押させる */
  REQUEST_END: 'request-end',
  /** 案内: 終了確認モーダルで「終了する」を押させる */
  CONFIRM_END: 'confirm-end',
  /** 結果: 「ホームに戻る」を押させてチュートリアルを終える */
  RETURN_HOME: 'return-home'
};

/**
 * ステップの定義。順序はこの配列の並びで表す。
 * message はその画面の案内役（マスコット）が吹き出しで話す文言。
 */
export const TUTORIAL_STEPS = [
  {
    step: TUTORIAL_STEP.SELECT_GENRE,
    routeName: 'route-condition',
    message: 'チュートリアルをはじめるよ！ まずは散歩のジャンル。「写真」を選んでみてね。'
  },
  {
    step: TUTORIAL_STEP.SELECT_DISTANCE,
    routeName: 'route-condition',
    message: '次は歩く距離だよ。スライダーを動かして 5km に合わせてね。'
  },
  {
    step: TUTORIAL_STEP.CREATE_ROUTE,
    routeName: 'route-condition',
    message: '準備ができたよ！「ルートを作成」を押してみよう。'
  },
  {
    step: TUTORIAL_STEP.CONFIRM_ROUTE,
    routeName: 'route-suggestion',
    message: 'これがおすすめのルート。地図で確かめたら「決定」を押してね。'
  },
  {
    step: TUTORIAL_STEP.ADVANCE_SPOT,
    routeName: 'route-navigation',
    message: '案内がはじまったよ。スポットに着いたら「次の目的地へ」を押して進もう。'
  },
  {
    step: TUTORIAL_STEP.SHOW_OTHER_REVIEWS,
    routeName: 'route-navigation',
    message:
      'みんなの口コミも見てみよう。右上の「みんな」を押すと、口コミのある場所が紫のピンで地図に出るよ。'
  },
  {
    step: TUTORIAL_STEP.OPEN_REVIEW,
    routeName: 'route-navigation',
    message: '紫のピンが出たね。タップすると、その場所の口コミを見られるよ。'
  },
  {
    step: TUTORIAL_STEP.RATE_REVIEW,
    routeName: 'route-navigation',
    message: 'この場所はどうだった？ ★をタップして5段階で評価してみてね。'
  },
  {
    step: TUTORIAL_STEP.SUBMIT_REVIEW,
    routeName: 'route-navigation',
    message: '評価できたら「投稿」を押して完了だよ。'
  },
  {
    step: TUTORIAL_STEP.LONG_PRESS_MAP,
    routeName: 'route-navigation',
    message:
      '次は新しい場所を登録してみよう。地図のどこかを長押しすると、その場所に口コミを付けられるよ。'
  },
  {
    step: TUTORIAL_STEP.INPUT_NEW_REVIEW,
    routeName: 'route-navigation',
    message:
      'フォームが開いたね。ロケーション名・ジャンル・★の評価を自由に入れてみてね。（チュートリアルでは実際には保存されないよ）'
  },
  {
    step: TUTORIAL_STEP.SUBMIT_NEW_REVIEW,
    routeName: 'route-navigation',
    message: '入力できたら「投稿」を押してみよう。'
  },
  {
    step: TUTORIAL_STEP.REQUEST_END,
    routeName: 'route-navigation',
    message: '散歩を終えるときは「終了」を押してね。'
  },
  {
    step: TUTORIAL_STEP.CONFIRM_END,
    routeName: 'route-navigation',
    message: '本当に終わっていい？「終了する」を押すと結果が見られるよ。'
  },
  {
    step: TUTORIAL_STEP.RETURN_HOME,
    routeName: 'walk-result',
    message: 'おつかれさま！ これがお散歩の結果だよ。「ホームに戻る」でチュートリアルは完了！'
  }
];
