import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @description cdk deploy の出力から Cognito の接続情報を取り出し、
 * 後続のステップが使えるよう GITHUB_ENV へ書き出す。
 * GitHub Actions のデプロイ（`.github/workflows/deploy.yml`）から実行する。
 *
 * ユーザープールは CDK で作るため、IDはデプロイするまで確定しない。
 * 人が変数へ登録する運用にすると登録漏れや古い値の残りが起きるため、
 * 常にデプロイ直後の出力から受け取る。
 *
 * 実行時の前提:
 * - `iac/cdk-outputs.json` が生成済み（`cdk deploy --outputs-file` を実行済み）
 * - 環境変数 `STAGE`（dev / prod）と `GITHUB_ENV` が設定されている
 */

/** プロジェクトのルートディレクトリ */
const rootDir = fileURLToPath(new URL('..', import.meta.url));

/** cdk deploy --outputs-file が出力したファイル */
const outputsFile = path.join(rootDir, 'iac', 'cdk-outputs.json');

/** 取り出す出力の名前と、フロントへ渡す環境変数名の対応 */
const EXPORTED_OUTPUTS = {
  UserPoolId: 'VITE_COGNITO_USER_POOL_ID',
  UserPoolClientId: 'VITE_COGNITO_USER_POOL_CLIENT_ID'
};

/**
 * @description GitHub Actions のログにエラーとして表示される形で出力する
 * @param {string} message 表示する内容
 * @returns {void}
 */
const logError = (message) => {
  console.error(`::error::${message}`);
};

const stage = process.env.STAGE ?? '';
const githubEnvPath = process.env.GITHUB_ENV ?? '';

if (stage === '' || githubEnvPath === '') {
  logError('環境変数 STAGE と GITHUB_ENV が必要です');
  process.exit(1);
}

const stackName = `Michishiru-${stage}`;
const outputs = JSON.parse(readFileSync(outputsFile, 'utf8'));
const stackOutputs = outputs[stackName] ?? {};

const missingOutputNames = Object.keys(EXPORTED_OUTPUTS).filter(
  (outputName) => !stackOutputs[outputName]
);

if (missingOutputNames.length > 0) {
  logError(
    `${stackName} の出力に ${missingOutputNames.join(' / ')} が見つかりません。` +
      'iac/lib/michishiru-stack.ts の CfnOutput を確認してください'
  );
  console.error(JSON.stringify(outputs, null, 2));
  process.exit(1);
}

const lines = Object.entries(EXPORTED_OUTPUTS).map(
  ([outputName, variableName]) => `${variableName}=${stackOutputs[outputName]}`
);

appendFileSync(githubEnvPath, `${lines.join('\n')}\n`);

console.log(`${stackName} の出力からCognitoの接続情報を読み込みました`);
lines.forEach((line) => console.log(`  ${line}`));
