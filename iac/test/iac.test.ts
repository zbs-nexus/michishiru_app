import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { MichishiruStack } from '../lib/michishiru-stack';
import { OidcStack } from '../lib/oidc-stack';

const env = { account: '123456789012', region: 'ap-northeast-1' };

describe('MichishiruStack', () => {
  const app = new cdk.App();
  const stack = new MichishiruStack(app, 'TestMichishiruStack', { env });
  const template = Template.fromStack(stack);

  test('GSI付きのDynamoDBテーブルを作成する', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      TableName: 'Route',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: 'GSI-CategoryDistance' })
      ])
    });
  });

  test('getRoute の Lambda 関数を作成する', () => {
    // autoDeleteObjects 用のカスタムリソース Lambda も生成されるため、
    // 件数ではなくハンドラと環境変数で getRoute 関数を特定する
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'functions/getRoute/handler.handler',
      Environment: {
        Variables: Match.objectLike({
          ROUTE_TABLE_NAME: Match.anyValue()
        })
      }
    });
  });

  test('API Gateway と GET メソッドを作成する', () => {
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET'
    });
  });

  test('非公開のS3バケットとCloudFrontディストリビューションを作成する', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      }
    });
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });
});

describe('OidcStack', () => {
  const app = new cdk.App();
  const stack = new OidcStack(app, 'TestOidcStack', {
    env,
    githubRepo: 'zbs-nexus/michishiru_app'
  });
  const template = Template.fromStack(stack);

  test('GitHub OIDC プロバイダとデプロイロールを作成する', () => {
    template.resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 1);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'github-actions-michishiru-deploy'
    });
  });
});
