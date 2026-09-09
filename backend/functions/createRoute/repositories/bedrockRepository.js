import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import {
  AWS_REGION,
  BEDROCK_MAX_TOKENS,
  BEDROCK_MODEL_ID,
  BEDROCK_TEMPERATURE
} from '../constants.js';

/**
 * @description Amazon Bedrock にルート案を生成させる。
 * 外部サービスへのアクセスと、生成結果のアプリ形式への変換のみを行う。
 */

/** クライアントの生成は1度だけ行い、呼び出しごとに作らない */
let bedrockClient = null;

/**
 * @description Bedrockのクライアントを取得する
 * @returns {BedrockRuntimeClient} 生成済みのクライアント
 */
const getBedrockClient = () => {
  if (bedrockClient === null) {
    bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
  }

  return bedrockClient;
};

/**
 * @description 生成テキストからJSON部分だけを取り出す。
 * JSONのみを返すよう指示しているが、マークダウンのコードフェンスが
 * 混ざることがあるため取り除いてから解析する。
 * @param {string} rawText Bedrockが生成したテキスト
 * @returns {object} 解析したJSON
 * @throws {ApplicationError} JSONとして解析できない場合
 */
const parseGeneratedJson = (rawText) => {
  const cleanedText = rawText.replaceAll('```json', '').replaceAll('```', '').trim();

  try {
    return JSON.parse(cleanedText);
  } catch {
    throw createDataSourceError('ルート案の生成結果を解析できませんでした', {
      // 全文はログを汚すため先頭のみ残す
      textHead: cleanedText.slice(0, 200)
    });
  }
};

/**
 * @description ルート案を生成する
 * @param {string} promptText Bedrockへ渡すプロンプト
 * @returns {Promise<{routeTitle: string, conceptStory: string, spots: {name: string, position: number[]}[]}>} 生成したルート案
 * @throws {ApplicationError} 外部サービスへのアクセスまたは解析に失敗した場合
 */
export const generateRoutePlan = async (promptText) => {
  let rawText = null;

  try {
    const response = await getBedrockClient().send(
      new ConverseCommand({
        modelId: BEDROCK_MODEL_ID,
        messages: [{ role: 'user', content: [{ text: promptText }] }],
        inferenceConfig: {
          temperature: BEDROCK_TEMPERATURE,
          maxTokens: BEDROCK_MAX_TOKENS
        }
      })
    );

    rawText = response.output?.message?.content?.[0]?.text ?? '';
  } catch (error) {
    throw createDataSourceError('ルート案の生成に失敗しました', {
      errorName: error.name,
      modelId: BEDROCK_MODEL_ID
    });
  }

  const generated = parseGeneratedJson(rawText);
  const selectedSpots = generated.selected_waypoints ?? [];

  if (!Array.isArray(selectedSpots) || selectedSpots.length === 0) {
    throw createDataSourceError('ルート案にスポットが含まれていませんでした');
  }

  // 生成結果のキーはsnake_caseのため、ここでアプリ形式（camelCase）へ変換する。
  // 用語辞書に従い、立ち寄り先は spot として扱う（経路の座標点は waypoint）。
  return {
    routeTitle: generated.route_title ?? '',
    conceptStory: generated.concept_story ?? '',
    spots: selectedSpots.map((spot) => ({
      name: spot.name,
      position: spot.position
    }))
  };
};
