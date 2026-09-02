import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

/** このスタックのプロパティ */
export interface OidcStackProps extends cdk.StackProps {
  /** 信頼する GitHub リポジトリ（owner/repo 形式） */
  readonly githubRepo: string;
}

/**
 * @description GitHub Actions から AWS へデプロイするための OIDC 連携を定義するスタック。
 * GitHub の OIDC プロバイダと、デプロイ用の IAM ロールを作成する。
 * このスタックは管理者権限で一度だけ手動デプロイし、以降 GitHub Actions がロールを引き受ける。
 */
export class OidcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OidcStackProps) {
    super(scope, id, props);

    const { githubRepo } = props;
    const [githubOwner, githubRepoName] = githubRepo.split('/');

    // GitHub Actions の OIDC プロバイダ
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com']
    });

    // GitHub Actions が引き受けるデプロイ用ロール
    const deployRole = new iam.Role(this, 'GithubActionsDeployRole', {
      roleName: 'github-actions-michishiru-deploy',
      // IAM ロールの description は Latin-1 のみ許可されるため英語で記述する
      description: 'Role assumed by GitHub Actions to deploy michishiru_app',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.OpenIdConnectPrincipal(githubProvider, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
        },
        StringLike: {
          // 指定リポジトリからのトークンのみ許可する（ブランチ/イベントは限定しない）。
          // 組織設定により sub が不変ID付き（repo:owner@ORGID/repo@REPOID:...）になる場合があるため、
          // 標準形式と不変ID形式の両方を許可する。
          'token.actions.githubusercontent.com:sub': [
            `repo:${githubRepo}:*`,
            `repo:${githubOwner}@*/${githubRepoName}@*:*`
          ]
        }
      })
    });

    // CDK の実行に必要な範囲だけを許可する。
    // 実デプロイは CDK がブートストラップ時に作成した cdk-* ロールを引き受けて行うため、
    // このロールには「それらのロールを引き受ける権限」のみを与える（最小権限）。
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`]
      })
    );

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'GitHub Actions に設定するデプロイ用ロールの ARN'
    });
  }
}
