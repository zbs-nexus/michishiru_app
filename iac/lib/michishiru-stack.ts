import * as path from 'node:path';
import * as fs from 'node:fs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

/** バックエンド（Lambda）ソースのルート */
const backendDir = path.resolve(__dirname, '..', '..', 'backend');

/** フロントエンドのビルド成果物ディレクトリ */
const frontendDistDir = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

/**
 * ルート生成に使う Bedrock のモデル ID（クロスリージョン推論プロファイル）。
 * Lambda 側の既定値と揃えており、環境変数で上書きできるようにするために IaC でも持つ。
 */
const bedrockModelId = 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';

/** デプロイ対象の環境（ステージ） */
export type Stage = 'dev' | 'prod';

/** MichishiruStack のプロパティ */
export interface MichishiruStackProps extends cdk.StackProps {
  /** デプロイ先の環境（dev / prod） */
  readonly stage: Stage;
  /**
   * バックエンド（Lambda + API Gateway + DynamoDB）を含めるかどうか。
   * 段階的な導入のため、既定ではフロントエンド（S3 + CloudFront）のみをデプロイする。
   * @default false
   */
  readonly withBackend?: boolean;
}

/**
 * @description ミチシルのインフラを定義するスタック。
 * フロントエンド（S3 + CloudFront）は常に構成し、バックエンド（Lambda + API Gateway + DynamoDB）は
 * `withBackend` が true のときのみ追加する（段階的導入のため）。
 * バックエンドを含む場合、`/api/*` は同一 CloudFront 経由で API Gateway へ転送する（同一オリジン＝CORS 不要）。
 * 環境（stage）ごとにスタック・リソース名を分け、同一アカウント内で dev / prod を共存させる。
 */
export class MichishiruStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MichishiruStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const withBackend = props.withBackend ?? false;

    // 本番のデータは保護（RETAIN）、開発は破棄しやすく（DESTROY）する
    const isProd = stage === 'prod';

    // 環境の識別用にスタック全体へタグを付与する
    cdk.Tags.of(this).add('Project', 'michishiru');
    cdk.Tags.of(this).add('Stage', stage);

    // ---- S3: フロントエンド配信用バケット（非公開・OAC 経由のみ） ----
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      // 環境が一目で分かる簡潔なバケット名（S3 はグローバル一意が必要）
      bucketName: `michishiru-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // 配信用の成果物のみを置くため、削除時はバケットごと破棄してよい
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // ---- Cognito: ログイン・ユーザー登録に使うユーザープール ----
    // フロントエンドが利用するため、withBackend に関係なく常に作成する。
    // サインインの識別子はユーザー名、メールアドレスは必須属性として確認コードで検証する。
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `michishiru-users-${stage}`,
      // 利用者が自分で登録できるようにする（ユーザー登録画面から signUp を呼ぶ）
      selfSignUpEnabled: true,
      signInAliases: { username: true },
      // 大文字小文字の違いで別ユーザーにならないようにする
      signInCaseSensitive: false,
      standardAttributes: {
        email: { required: true, mutable: true }
      },
      // 登録時にメールアドレスへ確認コードを送り、入力できたら有効化する
      autoVerify: { email: true },
      userVerification: {
        emailSubject: 'ミチシル - メールアドレスの確認',
        emailBody: 'ミチシルへのご登録ありがとうございます。確認コードは {####} です。',
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7)
      },
      mfa: cognito.Mfa.OFF,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // 既定のCognito送信元を使う。独自ドメインから送る場合はSESの設定が必要
      email: cognito.UserPoolEmail.withCognito(),
      // 本番は誤操作で消えないよう保護し、開発は作り直せるようにする
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
    });

    // SPA 用のアプリクライアント。クライアントシークレットは持たせない
    // （ブラウザに置くと漏れるため、SPAでは使えない）
    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: `michishiru-web-${stage}`,
      generateSecret: false,
      // パスワードをそのまま送らないSRPと、トークン更新のみを許可する
      authFlows: { userSrp: true, user: true },
      // Cognito がホストするログイン画面（マネージドログイン）は使わず、
      // 画面はアプリ内に自作している。OAuth のリダイレクト経路は開けない
      disableOAuth: true,
      // ユーザーが存在しないことを伏せる（ユーザー名の探り当てを防ぐ）
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(5)
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description:
        'Cognito ユーザープールID（GitHub の Environment 変数 VITE_COGNITO_USER_POOL_ID に設定する）'
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description:
        'Cognito アプリクライアントID（GitHub の Environment 変数 VITE_COGNITO_USER_POOL_CLIENT_ID に設定する）'
    });

    // ---- バックエンド（任意）: DynamoDB + Lambda + API Gateway ----
    // withBackend が true のときのみ構成する。
    let apiOrigin: origins.RestApiOrigin | undefined;

    if (withBackend) {
      // DynamoDB: ルートを格納するテーブル
      const routeTable = new dynamodb.TableV2(this, 'RouteTable', {
        tableName: `Route-${stage}`,
        partitionKey: { name: 'routeId', type: dynamodb.AttributeType.STRING },
        billing: dynamodb.Billing.onDemand(),
        // 本番はデータ保護のため保持、開発は削除時に破棄する
        removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        globalSecondaryIndexes: [
          {
            // カテゴリ + 距離で検索するための GSI（設計書に準拠）
            indexName: 'GSI-CategoryDistance',
            partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'distance', type: dynamodb.AttributeType.NUMBER }
          }
        ]
      });

      // DynamoDB: 口コミ（場所メタ＋口コミ）を格納するテーブル（単一テーブル設計）
      //   pk=spotId, sk='SPOT'（場所メタ）/ 'REVIEW#<userId>'（各ユーザーの口コミ）
      const reviewTable = new dynamodb.TableV2(this, 'ReviewTable', {
        tableName: `Review-${stage}`,
        partitionKey: { name: 'spotId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        billing: dynamodb.Billing.onDemand(),
        removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        globalSecondaryIndexes: [
          {
            // 近接する場所をグリッドのセルで引くための GSI（半径40mの候補絞り込み）。
            // 場所メタ行のみ geoCell を持つため、口コミ行は含まれない（疎なインデックス）
            indexName: 'GSI-GeoCell',
            partitionKey: { name: 'geoCell', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'spotId', type: dynamodb.AttributeType.STRING }
          },
          {
            // ユーザーが投稿した口コミを新しい順に引くための GSI。
            // 口コミ行のみ userId を持つため、場所メタ行は含まれない（疎なインデックス）
            indexName: 'GSI-UserReview',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING }
          }
        ]
      });

      // backend は素の ESM JavaScript で、依存する AWS SDK v3 は Lambda ランタイムに
      // 同梱されるため、バンドルせず backend ディレクトリをそのままデプロイする。
      // 複数の関数で同じコード資産を共有する。
      const backendCode = lambda.Code.fromAsset(backendDir, {
        exclude: ['node_modules', 'package-lock.json', '**/__tests__/**']
      });

      // Lambda: getRoute ハンドラ
      const getRouteFn = new lambda.Function(this, 'GetRouteFunction', {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'functions/getRoute/handler.handler',
        code: backendCode,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          ROUTE_TABLE_NAME: routeTable.tableName
        }
      });

      routeTable.grantReadData(getRouteFn);

      // 検索条件マスタ（michimaster）とスポットカテゴリマスタ。
      // どちらも CDK では作成しておらず、コンソールで手動作成済みのため名前で参照する。
      // createRoute は検索条件マスタのジャンル項目で英語ID（genreId）を数値ジャンルキー
      // （genre_id）へ変換し、その値でスポットカテゴリマスタを引く。
      // getConditions も同じ検索条件マスタを参照する（旧 michishiru_genremaster_akutsu は廃止）。
      // TODO: CDK 管理へ移し、命名規則（`PascalCase単数形-<環境>`）へ揃える。
      //       スポットカテゴリマスタの名前は個人名を含み、dev / prod の分離もされていない。
      const conditionTable = dynamodb.Table.fromTableName(
        this,
        'ConditionTable',
        'michimaster'
      );
      const spotCategoryTable = dynamodb.Table.fromTableName(
        this,
        'SpotCategoryTable',
        'michishiru_categorymaster_akutsu'
      );

      // Lambda: createRoute ハンドラ（Places + Bedrock + Routes でルートを生成する）
      // getRoute と違い AWS SDK v3 の geo-places / geo-routes / bedrock-runtime に依存する。
      // これらが Lambda ランタイムに同梱されている保証がないため、esbuild で
      // 依存ごと1ファイルにバンドルしてデプロイする。
      //
      // バンドルは backend/ を作業ディレクトリとして実行されるため、
      // synth / deploy の前に backend で `npm ci` を済ませておく必要がある
      // （依存の解決と esbuild 本体の両方を backend/node_modules から読む）。
      const createRouteFn = new nodejs.NodejsFunction(this, 'CreateRouteFunction', {
        runtime: lambda.Runtime.NODEJS_LATEST,
        entry: path.join(backendDir, 'functions', 'createRoute', 'handler.js'),
        handler: 'handler',
        projectRoot: backendDir,
        depsLockFilePath: path.join(backendDir, 'package-lock.json'),
        memorySize: 512,
        // API Gateway (REST) の統合タイムアウト上限が 29 秒のため、それに合わせる
        timeout: cdk.Duration.seconds(29),
        environment: {
          BEDROCK_MODEL_ID: bedrockModelId,
          CONDITION_TABLE_NAME: conditionTable.tableName,
          SPOT_CATEGORY_TABLE_NAME: spotCategoryTable.tableName
        },
        bundling: {
          // 既定では @aws-sdk/* と @smithy/* が外部化される。ランタイム同梱に
          // 依存しないよう、明示的に空にしてすべてバンドルへ含める。
          externalModules: [],
          minify: true,
          sourceMap: false
        }
      });

      conditionTable.grantReadData(createRouteFn);
      spotCategoryTable.grantReadData(createRouteFn);

      // Location Service（Places / Routes）はリソース単位の指定に対応しないため
      // resources は '*' になる。アクションを個別に絞ることで権限を限定する。
      createRouteFn.addToRolePolicy(
        new iam.PolicyStatement({
          sid: 'SearchNearbySpots',
          actions: ['geo-places:SearchNearby'],
          resources: ['*']
        })
      );
      createRouteFn.addToRolePolicy(
        new iam.PolicyStatement({
          sid: 'CalculateWalkingRoutes',
          actions: ['geo-routes:CalculateRoutes'],
          resources: ['*']
        })
      );
      // クロスリージョン推論プロファイルは、プロファイル自体と転送先の
      // 基盤モデルの両方に対する許可が必要になる。
      createRouteFn.addToRolePolicy(
        new iam.PolicyStatement({
          sid: 'InvokeBedrockModel',
          actions: ['bedrock:InvokeModel'],
          resources: [
            `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${bedrockModelId}`,
            'arn:aws:bedrock:*::foundation-model/anthropic.*'
          ]
        })
      );

      // Lambda: getConditions ハンドラ（検索条件マスタの全項目を返す）
      const getConditionsFn = new lambda.Function(this, 'GetConditionsFunction', {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'functions/getConditions/handler.handler',
        code: backendCode,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          CONDITION_TABLE_NAME: conditionTable.tableName
        }
      });

      conditionTable.grantReadData(getConditionsFn);

      // Lambda: getSpot ハンドラ（長押し位置に既存の口コミ場所があるかを返す）
      // DynamoDB のみを使うため、ディレクトリをそのまま配置する。
      const getSpotFn = new lambda.Function(this, 'GetSpotFunction', {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'functions/getSpot/handler.handler',
        code: backendCode,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          REVIEW_TABLE_NAME: reviewTable.tableName
        }
      });

      reviewTable.grantReadData(getSpotFn);

      // Lambda: createReview ハンドラ（口コミを投稿し、場所の集計を更新する）
      const createReviewFn = new lambda.Function(this, 'CreateReviewFunction', {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'functions/createReview/handler.handler',
        code: backendCode,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          REVIEW_TABLE_NAME: reviewTable.tableName
        }
      });

      reviewTable.grantReadWriteData(createReviewFn);

      // Lambda: verifyPasswordResetTarget ハンドラ
      // （パスワード再設定の前に、ユーザー名とメールアドレスの組み合わせを照合する）
      // ブラウザからはユーザーの登録情報を参照できないため、サーバー側で確かめる。
      // Cognito のクライアントがランタイムに同梱されている保証がないため、バンドルする。
      const verifyPasswordResetTargetFn = new nodejs.NodejsFunction(
        this,
        'VerifyPasswordResetTargetFunction',
        {
          runtime: lambda.Runtime.NODEJS_LATEST,
          entry: path.join(
            backendDir,
            'functions',
            'verifyPasswordResetTarget',
            'handler.js'
          ),
          handler: 'handler',
          projectRoot: backendDir,
          depsLockFilePath: path.join(backendDir, 'package-lock.json'),
          memorySize: 256,
          timeout: cdk.Duration.seconds(10),
          environment: {
            USER_POOL_ID: userPool.userPoolId
          },
          bundling: {
            externalModules: [],
            minify: true,
            sourceMap: false
          }
        }
      );

      // 照合に必要な読み取りだけを、作成したユーザープールに限って許可する
      verifyPasswordResetTargetFn.addToRolePolicy(
        new iam.PolicyStatement({
          sid: 'ReadUserForPasswordReset',
          actions: ['cognito-idp:AdminGetUser'],
          resources: [userPool.userPoolArn]
        })
      );

      // API Gateway
      //   GET  /api/v1/routes                      既存ルートの取得
      //   POST /api/v1/routes                      条件からルートを生成
      //   GET  /api/v1/conditions                  検索条件マスタの取得
      //   GET  /api/v1/spots                       長押し位置の既存口コミ場所の解決（要認証）
      //   POST /api/v1/reviews                     口コミの投稿（要認証）
      //   POST /api/v1/password-reset-verifications ユーザー名とメールアドレスの照合
      const api = new apigateway.RestApi(this, 'MichishiruApi', {
        restApiName: `michishiru-api-${stage}`,
        description: 'ミチシル ルート取得 API',
        deployOptions: {
          stageName: stage
        }
      });

      // API Gateway のオーソライザー。
      // ユーザープールは withBackend の外で常に作っているため、このブロックからそのまま参照できる。
      // URL を知っていれば誰でも叩ける状態を避けるため、ログイン後に呼ぶメソッドは
      // すべてこのオーソライザーで保護する。検証は API Gateway が行うため、
      // Lambda 側にトークンを検証する処理は不要になる。
      // フロントは Cognito の idToken を Authorization ヘッダーに載せて送る
      // （スキーム接頭辞は付けない。既定ではヘッダーの値をトークンそのものとして扱う）。
      // 後続のタスクで Lambda は event.requestContext.authorizer.claims.sub から
      // ユーザーを識別し、散歩の実績をユーザー単位で保存する。
      const apiAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
        this,
        'ApiAuthorizer',
        {
          cognitoUserPools: [userPool],
          // API 本体と同じ理由で物理名を指定する（AWSコンソールで識別するため）
          authorizerName: `michishiru-api-authorizer-${stage}`
        }
      );

      // 保護する3メソッドへ渡す設定。authorizationType は省略すると
      // 既定値に引きずられるため、COGNITO を明示する。
      const cognitoAuthorized: apigateway.MethodOptions = {
        authorizer: apiAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO
      };

      const v1Resource = api.root.addResource('api').addResource('v1');

      // GET / POST /api/v1/routes
      // フロントは router.beforeEach で全画面をログインゲートしており、
      // ログイン前にルートの取得・生成を呼ぶ経路が存在しない。
      // したがって2メソッドとも認可を必須にしてよい。
      const routesResource = v1Resource.addResource('routes');
      routesResource.addMethod(
        'GET',
        new apigateway.LambdaIntegration(getRouteFn),
        cognitoAuthorized
      );
      routesResource.addMethod(
        'POST',
        new apigateway.LambdaIntegration(createRouteFn),
        cognitoAuthorized
      );

      // GET /api/v1/conditions
      // 検索条件マスタもホーム画面（ログイン後）からしか呼ばないため保護する。
      // 1つでも付け忘れると未認証の穴が残るため、テストで NONE の件数を数えている。
      const conditionsResource = v1Resource.addResource('conditions');
      conditionsResource.addMethod(
        'GET',
        new apigateway.LambdaIntegration(getConditionsFn),
        cognitoAuthorized
      );

      // GET /api/v1/spots（長押し位置の既存口コミ場所を解決する。要認証）
      const spotsResource = v1Resource.addResource('spots');
      spotsResource.addMethod(
        'GET',
        new apigateway.LambdaIntegration(getSpotFn),
        cognitoAuthorized
      );

      // POST /api/v1/reviews（口コミを投稿する。要認証）
      const reviewsResource = v1Resource.addResource('reviews');
      reviewsResource.addMethod(
        'POST',
        new apigateway.LambdaIntegration(createReviewFn),
        cognitoAuthorized
      );

      // POST /api/v1/password-reset-verifications
      // ここだけ認可を付けない。パスワードを忘れた利用者がログインする前に呼ぶため、
      // Cognito オーソライザーで守ると機能しなくなる。
      // 総当たりへの備えは回数制限（API Gateway のスロットリング / WAF）で行う方針だが、
      // まだ未対応（ミチシル_前提条件.md の「照合APIの保護」に残置）。
      const passwordResetVerificationsResource = v1Resource.addResource(
        'password-reset-verifications'
      );
      passwordResetVerificationsResource.addMethod(
        'POST',
        new apigateway.LambdaIntegration(verifyPasswordResetTargetFn)
      );

      apiOrigin = new origins.RestApiOrigin(api);

      new cdk.CfnOutput(this, 'ApiEndpoint', {
        value: api.url,
        description: 'API Gateway のエンドポイント（直接アクセス用。通常は CloudFront 経由）'
      });
      new cdk.CfnOutput(this, 'RouteTableName', {
        value: routeTable.tableName,
        description: 'ルートを格納する DynamoDB テーブル名'
      });
      new cdk.CfnOutput(this, 'ReviewTableName', {
        value: reviewTable.tableName,
        description: '口コミ（場所メタ＋口コミ）を格納する DynamoDB テーブル名'
      });
    }

    // ---- CloudFront: SPA 配信（バックエンドがある場合は /api/* を API Gateway へ） ----
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: `ミチシル フロントエンド配信 (${stage})`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      },
      additionalBehaviors: apiOrigin
        ? {
            // API へのリクエストはキャッシュせず、クエリ文字列を含めて転送する
            'api/*': {
              origin: apiOrigin,
              viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
              allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
              cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
              // Host ヘッダを除く全ての情報（クエリ文字列含む）をオリジンへ渡す
              originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
            }
          }
        : undefined,
      errorResponses: [
        // SPA のため、S3 が返す 403/404 は index.html にフォールバックさせる
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }
      ]
    });

    // ---- フロントエンド成果物のデプロイ ----
    // frontend/dist が存在する場合のみアップロードする。
    // （ビルド前の cdk synth ではスキップし、インフラのみを合成する）
    if (fs.existsSync(frontendDistDir)) {
      new s3deploy.BucketDeployment(this, 'DeploySite', {
        sources: [s3deploy.Source.asset(frontendDistDir)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/*']
      });
    } else {
      cdk.Annotations.of(this).addInfo(
        `frontend/dist が見つからないため、静的ファイルのアップロードをスキップしました（${frontendDistDir}）。` +
          'デプロイ前に frontend のビルドを実行してください。'
      );
    }

    // ---- 出力（フロントエンド） ----
    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'フロントエンドの公開 URL（CloudFront）'
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront ディストリビューション ID'
    });
    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'フロントエンド配信用 S3 バケット名'
    });
  }
}
