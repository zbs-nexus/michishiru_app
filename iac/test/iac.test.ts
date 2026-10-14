import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { MichishiruStack } from '../lib/michishiru-stack';
import { OidcStack } from '../lib/oidc-stack';

const env = { account: '123456789012', region: 'ap-northeast-1' };

describe('MichishiruStack (フロントのみ・既定)', () => {
  const app = new cdk.App();
  const stack = new MichishiruStack(app, 'TestFrontendOnly', { env, stage: 'dev' });
  const template = Template.fromStack(stack);

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

  test('バックエンド（API Gateway / DynamoDB）は作成しない', () => {
    template.resourceCountIs('AWS::ApiGateway::RestApi', 0);
    template.resourceCountIs('AWS::DynamoDB::GlobalTable', 0);
  });

  test('セルフサインアップとメール確認を有効にしたユーザープールを作成する', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'michishiru-users-dev',
      AutoVerifiedAttributes: ['email'],
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
          RequireUppercase: true,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true
        })
      },
      Schema: Match.arrayWith([
        Match.objectLike({ Name: 'email', Required: true })
      ])
    });
  });

  test('シークレットを持たないSPA用アプリクライアントを作成する', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'michishiru-web-dev',
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
      PreventUserExistenceErrors: 'ENABLED'
    });
  });
});

describe('MichishiruStack (バックエンド有効)', () => {
  const app = new cdk.App();
  const stack = new MichishiruStack(app, 'TestWithBackend', {
    env,
    stage: 'prod',
    withBackend: true
  });
  const template = Template.fromStack(stack);

  test('GSI付きのDynamoDBテーブルを作成する', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      TableName: 'Route-prod',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: 'GSI-CategoryDistance' })
      ])
    });
  });

  test('getRoute の Lambda 関数を作成する', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'functions/getRoute/handler.handler',
      Environment: {
        Variables: Match.objectLike({
          ROUTE_TABLE_NAME: Match.anyValue()
        })
      }
    });
  });

  test('createRoute の Lambda 関数をバンドルして作成する', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      // NodejsFunction はバンドル結果を index.mjs / index.js として出力する
      Handler: 'index.handler',
      Environment: {
        Variables: Match.objectLike({
          BEDROCK_MODEL_ID: 'jp.anthropic.claude-haiku-4-5-20251001-v1:0',
          CONDITION_TABLE_NAME: 'michimaster',
          SPOT_CATEGORY_TABLE_NAME: 'michishiru_categorymaster_akutsu'
        })
      }
    });
  });

  test('createRoute にマスタテーブルの読み取り権限を与える', () => {
    // ARN の表現（文字列 / Fn::Join）に依存しないよう、対象ポリシーを論理IDで引いて中身を確認する
    const policies = template.findResources('AWS::IAM::Policy');
    const createRoutePolicy = Object.entries(policies).find(([logicalId]) =>
      logicalId.startsWith('CreateRouteFunctionServiceRoleDefaultPolicy')
    );

    expect(createRoutePolicy).toBeDefined();

    const policyJson = JSON.stringify(createRoutePolicy?.[1] ?? {});

    expect(policyJson).toContain('dynamodb:Scan');
    expect(policyJson).toContain('michimaster');
    expect(policyJson).toContain('michishiru_categorymaster_akutsu');
  });

  test('createRoute に Places / Routes / Bedrock の権限を与える', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'SearchNearbySpots',
            Action: 'geo-places:SearchNearby',
            Resource: '*'
          }),
          Match.objectLike({
            Sid: 'CalculateWalkingRoutes',
            Action: 'geo-routes:CalculateRoutes',
            Resource: '*'
          }),
          Match.objectLike({
            Sid: 'InvokeBedrockModel',
            Action: 'bedrock:InvokeModel'
          })
        ])
      }
    });
  });

  test('API Gateway と GET / POST メソッドを作成する', () => {
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET'
    });
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST'
    });
  });

  test('API に Cognito オーソライザーを1つ作成する', () => {
    template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'COGNITO_USER_POOLS',
      Name: 'michishiru-api-authorizer-prod',
      // ユーザープールのARNは Fn::GetAtt で解決されるため、値の形には依存させない
      ProviderARNs: Match.anyValue()
    });
  });

  test('ログイン後に呼ぶ8つのメソッドを Cognito 認可で保護する', () => {
    const methods = Object.values(template.findResources('AWS::ApiGateway::Method'));
    const authorizedMethods = methods.filter(
      (method) => method.Properties?.AuthorizationType === 'COGNITO_USER_POOLS'
    );

    expect(authorizedMethods).toHaveLength(8);

    for (const method of authorizedMethods) {
      expect(method.Properties?.AuthorizerId).toBeDefined();
    }

    // routes GET/POST、conditions GET、spots GET、reviews POST、
    // review-photo-uploads POST、my-reviews GET、walk-results POST
    expect(
      authorizedMethods.map((method) => method.Properties?.HttpMethod).sort()
    ).toEqual(['GET', 'GET', 'GET', 'GET', 'POST', 'POST', 'POST', 'POST']);
  });

  test('未認証のメソッドはログイン前に呼ぶ照合APIだけである', () => {
    // 認可を付け忘れたメソッドを足したら落ちるようにするための検証。
    // 論理IDは CDK の生成規則に依存するため、直書きせず経路から引く
    const resources = template.findResources('AWS::ApiGateway::Resource');
    const passwordResetResourceId = Object.entries(resources).find(
      ([, resource]) => resource.Properties?.PathPart === 'password-reset-verifications'
    )?.[0];

    expect(passwordResetResourceId).toBeDefined();

    const methods = Object.values(template.findResources('AWS::ApiGateway::Method'));
    const unauthorizedMethods = methods.filter(
      (method) => method.Properties?.AuthorizationType !== 'COGNITO_USER_POOLS'
    );

    expect(unauthorizedMethods).toHaveLength(1);
    expect(unauthorizedMethods[0].Properties?.ResourceId?.Ref).toBe(
      passwordResetResourceId
    );
  });

  test('verifyPasswordResetTarget の Lambda 関数とAPIの経路を作成する', () => {
    // NodejsFunction はバンドル結果を index として出力するため、環境変数で見分ける
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          USER_POOL_ID: Match.anyValue()
        })
      }
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'password-reset-verifications'
    });
  });

  test('照合用の Lambda には対象のユーザープールへの AdminGetUser だけを許可する', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'ReadUserForPasswordReset',
            Action: 'cognito-idp:AdminGetUser'
          })
        ])
      }
    });
  });

  test('実績テーブルを pk / sk の単一テーブル設計で作成し GSI を持たない', () => {
    const tables = template.findResources('AWS::DynamoDB::GlobalTable');
    const walkResultTable = Object.values(tables).find(
      (table) => table.Properties?.TableName === 'WalkResult-prod'
    );

    expect(walkResultTable).toBeDefined();
    expect(walkResultTable?.Properties?.KeySchema).toEqual([
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' }
    ]);
    // 履歴は pk + sk の前方一致で引けるため索引を増やさない（増えたら気付けるようにする）
    expect(walkResultTable?.Properties?.GlobalSecondaryIndexes).toBeUndefined();
  });

  test('createWalkResult の Lambda 関数を作成する', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'functions/createWalkResult/handler.handler',
      Environment: {
        Variables: Match.objectLike({
          WALK_RESULT_TABLE_NAME: Match.anyValue()
        })
      }
    });
  });

  test('実績保存のAPIの経路を作成する', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'walk-results'
    });
  });

  test('createWalkResult には実績テーブルの Put と Update だけを与える', () => {
    // ARN の表現に依存しないよう、対象ポリシーを論理IDで引いて中身を確認する
    const policies = template.findResources('AWS::IAM::Policy');
    const createWalkResultPolicy = Object.entries(policies).find(([logicalId]) =>
      logicalId.startsWith('CreateWalkResultFunctionServiceRoleDefaultPolicy')
    );

    expect(createWalkResultPolicy).toBeDefined();

    const policyJson = JSON.stringify(createWalkResultPolicy?.[1] ?? {});

    expect(policyJson).toContain('dynamodb:PutItem');
    expect(policyJson).toContain('dynamodb:UpdateItem');
    // 読み取りは行わないため、許可に含まれていないことを確認する
    expect(policyJson).not.toContain('dynamodb:Query');
    expect(policyJson).not.toContain('dynamodb:GetItem');
    // 削除もこの関数の役割ではない（grantWriteData だと付いてしまう）
    expect(policyJson).not.toContain('dynamodb:DeleteItem');
    expect(policyJson).not.toContain('dynamodb:BatchWriteItem');
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
