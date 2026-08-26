<script setup>
import logoImage from '@/assets/images/logo.png';

/**
 * @description ルート作成中に表示する待機画面。
 * 進行状況の判定は行わず、表示のみを担当する。
 */
</script>

<template>
  <div class="screen">
    <div class="loading-bg" />
    <div class="loading-content">
      <div class="logo-icon large">
        <img
          :src="logoImage"
          alt="ミチシル"
          width="100"
          height="100"
        >
      </div>
      <h2>ミチシル</h2>
      <p class="subtitle">
        ルート提案型お散歩アプリ
      </p>
      <h3 class="loading-text">
        ルートを作成中...
      </h3>
      <p class="loading-subtext">
        あなたにぴったりの<br>お散歩ルートを考えています
      </p>
      <div class="loading-dots">
        <span /><span /><span /><span /><span />
      </div>
    </div>
  </div>
</template>
