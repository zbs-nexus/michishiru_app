/**
 * @description 実際の検索条件を使い、すべてのジャンル・距離パターンを網羅するテスト。
 * 本番と同じタイムアウト設定で、各パターンを複数回実行して失敗傾向を把握する。
 * 環境変数未設定の場合はseedデータを使用する。
 */

import { test } from 'node:test';
import { listConditions, hasConditionTable } from '../../getConditions/repository.js';

/**
 * @description 実環境の createRoute を呼び出す（タイムアウト設定付き）
 * @param {object} conditions 検索条件
 * @param {number} timeoutMs タイムアウト（ms）
 * @returns {Promise<object>} ルート生成結果
 */
const callCreateRouteWithTimeout = async (conditions, timeoutMs = 29000) => {
  // 実際のサービスをインポート（モックなし）
  const { createRoute } = await import('../service.js');

  return Promise.race([
    createRoute(conditions),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    )
  ]);
};

test('実際の検索条件で包括的なルート生成テスト', async (t) => {
  console.log('\n=== 包括的ルート生成テスト ===\n');
  console.log('テスト設定:');
  console.log(`  - 検索条件: ${hasConditionTable() ? 'DynamoDB' : 'seedデータ（ローカル）'}`);
  console.log('  - タイムアウト: 29秒（本番と同じ）');
  console.log('  - 各パターンの実行回数: 3回');
  console.log('  - 最低テスト回数: 100回\n');

  // Step 1: 検索条件を取得
  console.log('Step 1: 検索条件を取得中...');
  const allConditions = await listConditions();

  // conditionType が設定されている場合（新形式）
  let genreItems = allConditions.filter((item) => item.conditionType === 'genre');
  let distanceItems = allConditions.filter((item) => item.conditionType === 'distance');

  // pk で判定する場合（seed / 旧形式）
  if (genreItems.length === 0) {
    genreItems = allConditions.filter((item) => item.pk?.startsWith('GENRE#'));
  }
  if (distanceItems.length === 0) {
    distanceItems = allConditions.filter((item) => item.pk?.startsWith('DISTANCE#'));
  }

  console.log(`  取得したジャンル数: ${genreItems.length}`);
  console.log(`  取得した距離選択肢数: ${distanceItems.length}`);

  // 現在の制約に合わせて距離選択肢を生成（1〜10km、1km刻み）
  const distances = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
  console.log(`  使用する距離: ${distances.join(', ')}km`);

  // ジャンルと距離の組み合わせを生成
  const patterns = [];
  for (const genre of genreItems) {
    for (const distanceKm of distances) {
      patterns.push({
        genreId: genre.genreId,
        genreName: genre.genreName || genre.displayName,
        distanceKm
      });
    }
  }

  console.log(`  生成されたパターン数: ${patterns.length}`);

  // 各パターンを3回ずつ実行
  const RUNS_PER_PATTERN = 3;
  const totalTests = patterns.length * RUNS_PER_PATTERN;

  console.log(`  総テスト回数: ${totalTests}回\n`);

  if (totalTests < 100) {
    console.log(`⚠️  警告: 総テスト回数が100回未満です（${totalTests}回）`);
    console.log(`  → ジャンルを追加するか、実行回数を増やしてください\n`);
  }

  // 現在地（新宿駅）
  const currentLocation = { lng: 139.702973, lat: 35.686338 };

  // seedデータで不足する場合のため、1km刻みの距離を生成
  if (totalTests < 100) {
    console.log(`  → テスト回数を増やすため、距離を1km刻みで生成します\n`);
    patterns.length = 0;  // クリア
    
    const distances = [];
    for (let d = 1.0; d <= 10.0; d += 1.0) {
      distances.push(d);
    }
    
    for (const genre of genreItems) {
      for (const distanceKm of distances) {
        patterns.push({
          genreId: genre.genreId,
          genreName: genre.genreName || genre.displayName,
          distanceKm
        });
      }
    }
    
    console.log(`  新しいパターン数: ${patterns.length}`);
    console.log(`  新しい総テスト回数: ${patterns.length * RUNS_PER_PATTERN}回\n`);
  }

  // Step 2: テスト実行
  console.log('Step 2: テスト実行中...\n');

  const results = [];
  let completedTests = 0;

  for (const pattern of patterns) {
    for (let run = 1; run <= RUNS_PER_PATTERN; run++) {
      const testId = `${pattern.genreId}-${pattern.distanceKm}km-run${run}`;

      const startTime = Date.now();
      let result = {
        testId,
        genreId: pattern.genreId,
        genreName: pattern.genreName,
        targetDistanceKm: pattern.distanceKm,
        run,
        success: false,
        error: null,
        errorType: null,
        actualDistanceKm: null,
        distanceRatio: null,
        spotCount: null,
        executionTime: null
      };

      try {
        const route = await callCreateRouteWithTimeout(
          {
            genreId: pattern.genreId,
            targetDistanceKm: pattern.distanceKm,
            currentLocation
          },
          29000 // API Gatewayと同じタイムアウト
        );

        result.success = true;
        result.actualDistanceKm = (route.totalDistanceM / 1000).toFixed(2);
        result.distanceRatio = (route.totalDistanceM / 1000 / pattern.distanceKm).toFixed(
          2
        );
        result.spotCount = route.spots.length;
        result.executionTime = Date.now() - startTime;
      } catch (error) {
        result.error = error.message;
        result.errorType = error.message === 'TIMEOUT' ? 'TIMEOUT' : error.code || 'UNKNOWN';
        result.executionTime = Date.now() - startTime;
      }

      results.push(result);
      completedTests++;

      // 進捗表示（10回ごと）
      if (completedTests % 10 === 0) {
        const successCount = results.filter((r) => r.success).length;
        const successRate = ((successCount / completedTests) * 100).toFixed(1);
        console.log(
          `  進捗: ${completedTests}/${totalTests} (${successRate}% 成功)`
        );
      }
    }
  }

  console.log(`\n完了: ${completedTests}/${totalTests}回のテストを実行\n`);

  // Step 3: 結果集計
  console.log('=== テスト結果サマリー ===\n');

  const successResults = results.filter((r) => r.success);
  const failureResults = results.filter((r) => !r.success);

  const successRate = ((successResults.length / results.length) * 100).toFixed(1);

  console.log(`総テスト回数: ${results.length}回`);
  console.log(`成功: ${successResults.length}回 (${successRate}%)`);
  console.log(`失敗: ${failureResults.length}回 (${(100 - successRate).toFixed(1)}%)\n`);

  // ジャンル別集計
  console.log('--- ジャンル別成功率 ---');
  const genreStats = {};
  for (const genre of genreItems) {
    const genreResults = results.filter((r) => r.genreId === genre.genreId);
    const genreSuccess = genreResults.filter((r) => r.success).length;
    const genreRate = ((genreSuccess / genreResults.length) * 100).toFixed(1);
    genreStats[genre.genreId] = {
      name: genre.displayName,
      total: genreResults.length,
      success: genreSuccess,
      rate: genreRate
    };
    console.log(
      `  ${genre.displayName}(${genre.genreId}): ${genreSuccess}/${genreResults.length} (${genreRate}%)`
    );
  }
  console.log('');

  // 距離別集計
  console.log('--- 距離別成功率 ---');
  const distanceStats = {};
  for (const distance of distanceItems) {
    const distResults = results.filter((r) => r.targetDistanceKm === distance.value);
    const distSuccess = distResults.filter((r) => r.success).length;
    const distRate = ((distSuccess / distResults.length) * 100).toFixed(1);
    distanceStats[distance.value] = {
      total: distResults.length,
      success: distSuccess,
      rate: distRate
    };
    console.log(`  ${distance.value}km: ${distSuccess}/${distResults.length} (${distRate}%)`);
  }
  console.log('');

  // 成功時の統計
  if (successResults.length > 0) {
    console.log('--- 成功時の統計 ---');

    const avgExecutionTime = (
      successResults.reduce((sum, r) => sum + r.executionTime, 0) / successResults.length
    ).toFixed(0);
    console.log(`  平均実行時間: ${avgExecutionTime}ms`);

    const avgSpotCount = (
      successResults.reduce((sum, r) => sum + r.spotCount, 0) / successResults.length
    ).toFixed(1);
    console.log(`  平均スポット数: ${avgSpotCount}個`);

    const avgDistanceRatio = (
      successResults.reduce((sum, r) => sum + parseFloat(r.distanceRatio), 0) /
      successResults.length
    ).toFixed(2);
    console.log(`  平均距離達成率: ${avgDistanceRatio}倍（目標に対する比率）\n`);
  }

  // 失敗詳細
  if (failureResults.length > 0) {
    console.log('--- 失敗詳細 ---');

    // エラータイプ別集計
    const errorTypes = {};
    for (const failure of failureResults) {
      errorTypes[failure.errorType] = (errorTypes[failure.errorType] || 0) + 1;
    }

    console.log('エラータイプ別:');
    for (const [type, count] of Object.entries(errorTypes)) {
      const rate = ((count / failureResults.length) * 100).toFixed(1);
      console.log(`  ${type}: ${count}件 (${rate}%)`);
    }
    console.log('');

    // パターン別失敗率（失敗が多い順）
    console.log('失敗が多いパターン（上位10件）:');
    const patternFailures = {};
    for (const result of results) {
      const key = `${result.genreName} × ${result.targetDistanceKm}km`;
      if (!patternFailures[key]) {
        patternFailures[key] = { total: 0, failures: 0 };
      }
      patternFailures[key].total++;
      if (!result.success) {
        patternFailures[key].failures++;
      }
    }

    const sortedPatterns = Object.entries(patternFailures)
      .map(([pattern, stats]) => ({
        pattern,
        failures: stats.failures,
        total: stats.total,
        rate: ((stats.failures / stats.total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 10);

    for (const item of sortedPatterns) {
      console.log(`  ${item.pattern}: ${item.failures}/${item.total}回失敗 (${item.rate}%)`);
    }
    console.log('');

    // 全失敗ケースの詳細（最大20件）
    console.log('失敗ケース詳細（最大20件）:');
    for (const failure of failureResults.slice(0, 20)) {
      console.log(`  [${failure.testId}]`);
      console.log(`    ジャンル: ${failure.genreName} (${failure.genreId})`);
      console.log(`    目標距離: ${failure.targetDistanceKm}km`);
      console.log(`    エラー: ${failure.errorType} - ${failure.error}`);
      console.log(`    実行時間: ${failure.executionTime}ms`);
      console.log('');
    }
  }

  // Step 4: 原因分析
  console.log('=== 原因分析 ===\n');

  if (failureResults.length === 0) {
    console.log('✅ すべてのテストが成功しました。');
  } else {
    console.log('失敗の主な原因:');

    // タイムアウト分析
    const timeouts = failureResults.filter((r) => r.errorType === 'TIMEOUT');
    if (timeouts.length > 0) {
      const timeoutRate = ((timeouts.length / failureResults.length) * 100).toFixed(1);
      console.log(
        `\n1. タイムアウト: ${timeouts.length}件 (失敗の${timeoutRate}%)`
      );
      console.log('   原因: 処理時間が29秒を超過');
      console.log('   影響するパターン:');
      const timeoutPatterns = {};
      for (const t of timeouts) {
        const key = `${t.genreName} × ${t.targetDistanceKm}km`;
        timeoutPatterns[key] = (timeoutPatterns[key] || 0) + 1;
      }
      for (const [pattern, count] of Object.entries(timeoutPatterns).slice(0, 5)) {
        console.log(`     - ${pattern}: ${count}回`);
      }
    }

    // ROUTE_NOT_FOUND分析
    const notFound = failureResults.filter((r) => r.errorType === 'ROUTE_NOT_FOUND');
    if (notFound.length > 0) {
      const notFoundRate = ((notFound.length / failureResults.length) * 100).toFixed(1);
      console.log(
        `\n2. ルート生成失敗: ${notFound.length}件 (失敗の${notFoundRate}%)`
      );
      console.log('   原因: 目標距離の許容範囲内にルートを作成できない');
      console.log('   影響するパターン:');
      const nfPatterns = {};
      for (const nf of notFound) {
        const key = `${nf.genreName} × ${nf.targetDistanceKm}km`;
        nfPatterns[key] = (nfPatterns[key] || 0) + 1;
      }
      for (const [pattern, count] of Object.entries(nfPatterns).slice(0, 5)) {
        console.log(`     - ${pattern}: ${count}回`);
      }
    }

    // その他のエラー
    const others = failureResults.filter(
      (r) => r.errorType !== 'TIMEOUT' && r.errorType !== 'ROUTE_NOT_FOUND'
    );
    if (others.length > 0) {
      console.log(`\n3. その他のエラー: ${others.length}件`);
      const otherTypes = {};
      for (const o of others) {
        otherTypes[o.errorType] = (otherTypes[o.errorType] || 0) + 1;
      }
      for (const [type, count] of Object.entries(otherTypes)) {
        console.log(`   - ${type}: ${count}件`);
      }
    }
  }

  console.log('\n=== テスト完了 ===\n');
});
