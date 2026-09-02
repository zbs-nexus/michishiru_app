#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MichishiruStack, Stage } from '../lib/michishiru-stack';
import { OidcStack } from '../lib/oidc-stack';

/** デプロイ先の AWS 環境（dev / prod は同一アカウント内で共存する） */
const env: cdk.Environment = {
  account: '961308088333',
  region: 'ap-northeast-1'
};

/** 信頼する GitHub リポジトリ */
const githubRepo = 'zbs-nexus/michishiru_app';

const app = new cdk.App();

// GitHub Actions のデプロイ用ロール（環境共通。管理者権限で一度だけデプロイする）
new OidcStack(app, 'MichishiruOidcStack', {
  env,
  githubRepo,
  description: 'GitHub Actions 用の OIDC 連携とデプロイロール'
});

// 環境ごとのアプリインフラ。
// develop ブランチ → Michishiru-dev、main ブランチ → Michishiru-prod をデプロイする。
const stages: Stage[] = ['dev', 'prod'];
for (const stage of stages) {
  new MichishiruStack(app, `Michishiru-${stage}`, {
    env,
    stage,
    description: `ミチシル インフラ (${stage})`
  });
}
