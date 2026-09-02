import * as path from 'node:path';
import * as fs from 'node:fs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

/** バックエンド（Lambda）ソースのルート */
const backendDir = path.resolve(__dirname, '..', '..', 'backend');

/** フロントエンドのビルド成果物ディレクトリ */
const frontendDistDir = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

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

      // Lambda: getRoute ハンドラ
      // backend は素の ESM JavaScript で、依存する AWS SDK v3 は Lambda ランタイムに
      // 同梱されるため、バンドルせず backend ディレクトリをそのままデプロイする。
      const getRouteFn = new lambda.Function(this, 'GetRouteFunction', {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'functions/getRoute/handler.handler',
        code: lambda.Code.fromAsset(backendDir, {
          exclude: ['node_modules', 'package-lock.json', '**/__tests__/**']
        }),
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          ROUTE_TABLE_NAME: routeTable.tableName
        }
      });

      routeTable.grantReadData(getRouteFn);

      // API Gateway: GET /api/v1/routes
      const api = new apigateway.RestApi(this, 'MichishiruApi', {
        restApiName: `michishiru-api-${stage}`,
        description: 'ミチシル ルート取得 API',
        deployOptions: {
          stageName: stage
        }
      });

      const routesResource = api.root
        .addResource('api')
        .addResource('v1')
        .addResource('routes');
      routesResource.addMethod('GET', new apigateway.LambdaIntegration(getRouteFn));

      apiOrigin = new origins.RestApiOrigin(api);

      new cdk.CfnOutput(this, 'ApiEndpoint', {
        value: api.url,
        description: 'API Gateway のエンドポイント（直接アクセス用。通常は CloudFront 経由）'
      });
      new cdk.CfnOutput(this, 'RouteTableName', {
        value: routeTable.tableName,
        description: 'ルートを格納する DynamoDB テーブル名'
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
