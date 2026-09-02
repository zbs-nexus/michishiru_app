#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MichishiruStack } from '../lib/michishiru-stack';
import { OidcStack } from '../lib/oidc-stack';

/** デプロイ先の AWS 環境 */
const env: cdk.Environment = {
  account: '961308088333',
  region: 'ap-northeast-1'
};

/** 信頼する GitHub リポジトリ */
const githubRepo = 'zbs-nexus/michishiru_app';

const app = new cdk.App();

// GitHub Actions のデプロイ用ロール（管理者権限で一度だけデプロイする）
new OidcStack(app, 'MichishiruOidcStack', {
  env,
  githubRepo,
  description: 'GitHub Actions 用の OIDC 連携とデプロイロール'
});

// アプリ本体のインフラ
new MichishiruStack(app, 'MichishiruStack', {
  env,
  description: 'ミチシル 本番インフラ（S3 + CloudFront / Lambda + API Gateway / DynamoDB）'
});
