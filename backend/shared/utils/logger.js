/**
 * @description CloudWatch Logsで検索しやすいJSON形式でログを出力する。
 * 特定の関数に依存しないよう、出力内容は呼び出し側から受け取る。
 */

/**
 * @description ログを1行のJSONとして書き出す
 * @param {string} level ログレベル
 * @param {string} message 概要
 * @param {object} [context] 付随情報
 * @returns {void}
 */
const write = (level, message, context = {}) => {
  const entry = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  });

  if (level === 'ERROR') {
    console.error(entry);
    return;
  }

  console.log(entry);
};

/**
 * @description 通常の処理経過を記録する
 * @param {string} message 概要
 * @param {object} [context] 付随情報
 * @returns {void}
 */
export const logInfo = (message, context) => write('INFO', message, context);

/**
 * @description 想定内だが注意が必要な事象を記録する
 * @param {string} message 概要
 * @param {object} [context] 付随情報
 * @returns {void}
 */
export const logWarn = (message, context) => write('WARN', message, context);

/**
 * @description 失敗を記録する
 * @param {string} message 概要
 * @param {object} [context] 付随情報
 * @returns {void}
 */
export const logError = (message, context) => write('ERROR', message, context);
