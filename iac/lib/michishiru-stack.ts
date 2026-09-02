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

/**
 * @description ミチシルの本番インフラを定義するスタック。
 * フロントエンド（S3 + CloudFront）とバックエンド（Lambda + API Gateway + DynamoDB）を1スタックで構成する。
 * フロントエンドは CloudFront から配信し、`/api/*` は同一ディストリビューション経由で
 * API Gateway へ転送する（同一オリジンとなるため CORS は不要）。
 */
export class MichishiruStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- DynamoDB: ルートを格納するテーブル ----
    const routeTable = new dynamodb.TableV2(this, 'RouteTable', {
      tableName: 'Route',
      partitionKey: { name: 'routeId', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      // データ保護のため、スタック削除時もテーブルは保持する
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          // カテゴリ + 距離で検索するための GSI（設計書に準拠）
          indexName: 'GSI-CategoryDistance',
          partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'distance', type: dynamodb.AttributeType.NUMBER }
        }
      ]
    });

    // ---- Lambda: getRoute ハンドラ ----
    // backend は素の ESM JavaScript で、依存する AWS SDK v3 は Lambda ランタイムに
    // 同梱されるため、バンドルせず backend ディレクトリをそのままデプロイする。
    // （backend/package.json の "type": "module" によりハンドラは ESM として実行される）
    const getRouteFn = new lambda.Function(this, 'GetRouteFunction', {
      // ランタイムは cdk.json の useLatestRuntimeVersion により最新 LTS が使われる
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

    // Lambda にテーブルの読み取り権限を付与する
    routeTable.grantReadData(getRouteFn);

    // ---- API Gateway: GET /api/v1/routes ----
    const api = new apigateway.RestApi(this, 'MichishiruApi', {
      restApiName: 'michishiru-api',
      description: 'ミチシル ルート取得 API',
      deployOptions: {
        stageName: 'prod'
      }
    });

    const apiResource = api.root.addResource('api');
    const v1Resource = apiResource.addResource('v1');
    const routesResource = v1Resource.addResource('routes');
    routesResource.addMethod('GET', new apigateway.LambdaIntegration(getRouteFn));

    // ---- S3: フロントエンド配信用バケット（非公開・OAC 経由のみ） ----
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // 配信用の成果物のみを置くため、削除時はバケットごと破棄してよい
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // ---- CloudFront: SPA 配信 + /api/* を API Gateway へ ----
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'ミチシル フロントエンド配信',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      },
      additionalBehaviors: {
        // API へのリクエストはキャッシュせず、クエリ文字列を含めて転送する
        'api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Host ヘッダを除く全ての情報（クエリ文字列含む）をオリジンへ渡す
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        }
      },
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

    // ---- 出力 ----
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
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway のエンドポイント（直接アクセス用。通常は CloudFront 経由）'
    });
    new cdk.CfnOutput(this, 'RouteTableName', {
      value: routeTable.tableName,
      description: 'ルートを格納する DynamoDB テーブル名'
    });
  }
}
