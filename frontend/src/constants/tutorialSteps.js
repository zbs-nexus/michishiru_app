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
  /** 案内: 地図の紫ピン（他の人の口コミの場所）をタップさせる */
  OPEN_REVIEW: 'open-review',
  /** 案内: 口コミフォームで★の評価を付けさせる */
  RATE_REVIEW: 'rate-review',
  /** 案内: 口コミの「投稿」を押させる（チュートリアルでは送信せずダミー完了） */
  SUBMIT_REVIEW: 'submit-review',
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
    step: TUTORIAL_STEP.OPEN_REVIEW,
    routeName: 'route-navigation',
    message:
      '気に入った場所には口コミを残せるよ。新しい場所は地図を長押しして登録できるんだ。今日は近くの紫のピンをタップして、みんなの口コミに評価を付けてみよう。'
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
