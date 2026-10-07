/**
 * @description 保存に失敗した散歩の実績を、次の機会に送り直せるよう退避しておく保管庫。
 * Vueに依存しないため、composableから呼び出して使う。
 *
 * 退避先は `localStorage`、つまり**端末のブラウザ内のストレージ**である。
 * スマートフォンのアプリ領域（ネイティブのファイル保存先）ではないため、
 * ブラウザのデータ削除・プライベートモードの終了・別ブラウザへの乗り換えで失われる。
 * Webアプリからネイティブのストレージは使えないため、この限界は受け入れる。
 * 読めるのは同一オリジン・同一ブラウザのみで、他の端末からは参照できない。
 *
 * したがって退避は best effort（できたらする）であり、退避そのものの失敗は
 * 利用者に見せない。ここで例外を投げ返すと、保存の失敗を知らせるという
 * 本来の処理まで巻き込んで落ちてしまう。
 */

/** 退避した実績を入れるキー。他の用途と混ざらないようアプリ名で名前空間を分ける */
const STORAGE_KEY = 'michishiru.pendingWalkResults';

/**
 * 退避できる最大件数。
 * 保存が長く失敗し続けてもストレージ（オリジンあたり数MB）を埋め尽くさないよう上限を置く。
 * 超えた場合は古いものから捨てる。古い散歩ほど、送れないまま時間が経っており
 * 利用者の関心も薄れているため。
 */
const MAX_PENDING_COUNT = 20;

/**
 * @description 退避している実績の一覧を取り出す
 * @returns {object[]} 退避している実績。無い場合や読めなかった場合は空の配列
 */
export const loadPendingWalkResults = () => {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue === null) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    // 手で書き換えられた・別バージョンが書いた値でも呼び出し側を止めない
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    // JSONとして壊れている場合と、localStorage 自体が使えない環境（プライベート
    // モードや容量超過）の両方をここで受ける。退避が読めないだけなら実害はない
    return [];
  }
};

/**
 * @description 実績を退避に積む。同じ walkId が既にある場合は置き換える。
 *
 * 積む項目の中身は呼び出し側（`useWalkResultSave`）が決める。この保管庫は
 * `walkId` で同じ散歩を見分けることだけを前提とし、持ち主や送る内容の形は知らない。
 * @param {object} pendingResult 退避する項目（walkId を持つ）
 * @returns {void}
 */
export const addPendingWalkResult = (pendingResult) => {
  try {
    // 再送が失敗して積み直された場合に同じ散歩が増えないよう、walkId で入れ替える
    const remainingResults = loadPendingWalkResults().filter(
      (storedResult) => storedResult.walkId !== pendingResult.walkId
    );

    const nextResults = [...remainingResults, pendingResult];

    localStorage.setItem(
      STORAGE_KEY,
      // 上限を超えた分は先頭（古い方）から落とす
      JSON.stringify(nextResults.slice(-MAX_PENDING_COUNT))
    );
  } catch {
    // 書き込めなくても何もしない。退避できなかったことを知らせても
    // 利用者には打てる手がなく、保存失敗のトーストと二重に不安を与えるだけ
  }
};

/**
 * @description 送信できた実績を退避から取り除く
 * @param {string} walkId 取り除く散歩のID
 * @returns {void}
 */
export const removePendingWalkResult = (walkId) => {
  try {
    const remainingResults = loadPendingWalkResults().filter(
      (pendingResult) => pendingResult.walkId !== walkId
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingResults));
  } catch {
    // 消せなかった場合は次の再送でもう一度送られる。APIは walkId で冪等なため
    // 二重に保存されることはなく、累計も増えない
  }
};
