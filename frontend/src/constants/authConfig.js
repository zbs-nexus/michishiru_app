/**
 * @description Cognito への接続情報を定義する。
 *
 * ユーザープールIDとアプリクライアントIDは公開前提の識別子であり、シークレットではない。
 * SPA用のアプリクライアントはクライアントシークレットを持たないため、
 * ビルド成果物に含まれても認証を突破する材料にはならない。
 * 環境（dev/prod）で値が変わるため、ビルド時に環境変数から取り込む。
 */

/** ユーザープールID。未設定の場合はnull */
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? null;

/** アプリクライアントID。未設定の場合はnull */
const USER_POOL_CLIENT_ID = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID ?? null;

/** Amplify へ渡す認証の設定 */
export const AUTH_CONFIG = {
  Cognito: {
    userPoolId: USER_POOL_ID,
    userPoolClientId: USER_POOL_CLIENT_ID
  }
};

/** 接続情報が揃っているかどうか */
export const HAS_CONFIGURED_AUTH =
  USER_POOL_ID !== null && USER_POOL_CLIENT_ID !== null;
