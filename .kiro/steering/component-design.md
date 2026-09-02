---
inclusion: fileMatch
fileMatchPattern: 'frontend/**'
---

# コンポーネント設計ルール — ミチシル（ルート作成地図アプリ）

---

## 単一責任の原則

### 基本方針

- 1コンポーネント = 1つの役割
- 「このコンポーネントは何をするか？」を1文で説明できない場合は分割を検討する

### 分割の目安

| 基準 | しきい値 |
|---|---|
| テンプレート行数 | 100行を超えたら分割 |
| script内のロジック | 関数が5つ以上になったら composable に切り出す |
| props数 | 7つ以上になったら設計を見直す |
| 責務の混在 | 表示ロジックとデータ取得が同居していたら分離 |

### コンポーネントの分類

| 種別 | 役割 | 名前の形 | 置き場所 |
|---|---|---|---|
| Page（View） | ページ全体の構成・データ取得 | `〇〇View.vue` | `views/` |
| Base | プロジェクト共通UI部品 | `Base〇〇.vue` | `components/base/` |
| Layout | 画面レイアウト構造 | `〇〇Layout.vue` | `components/layout/` |
| Presentational | propsを受け取り表示のみ | 機能名 + 役割 | `components/feature/<機能名>/` |

例: `RouteConditionView.vue`, `BaseButton.vue`, `DefaultLayout.vue`, `SpotPin.vue`

**`App` プレフィックスは使用しない。** Vue のルートコンポーネント `App.vue` と混同するため。汎用UI部品は `Base〇〇`、レイアウトは `〇〇Layout` の2種類に限る。

---

## Props ルール

### 命名

- 宣言は camelCase で行う
- Boolean は `is` / `has` / `can` プレフィックスをつける
- イベントハンドラ用の props は使わない（emit を使う）

### Props のルール一覧

| ルール | 理由 |
|---|---|
| `required: true` または `default` を必ず指定する | 未定義の挙動を防ぐ |
| オブジェクト・配列の default はファクトリ関数にする | 参照共有バグを防ぐ |
| props を直接変更しない（読み取り専用） | 一方向データフローを守る |
| 不要に大きなオブジェクトを丸ごと渡さない | 依存を明確にする |

---

## Emit ルール

### 命名

- 宣言は camelCase の動詞形にする
- `on` プレフィックスはつけない

### Emit のルール一覧

| ルール | 理由 |
|---|---|
| `defineEmits` で宣言してから使う | 明示的で読みやすい |
| 親がリスンしていなくても emit して良い | 疎結合を保つ |
| ペイロードの形は固定する | 予測可能にする |

---

## props / emit の大文字小文字（重要）

Vue の仕様上、**同じ名前を2通りの書き方で書く必要がある**。片方に統一しようとすると動かない。

| 場所 | 書き方 | 例 |
|---|---|---|
| `defineProps` の宣言 | camelCase | `spotCount: { type: Number, required: true }` |
| 親から渡すときの属性 | kebab-case | `:spot-count="spotCount"` |
| `defineEmits` の宣言 | camelCase | `defineEmits(['selectGenre'])` |
| `$emit()` の呼び出し | camelCase | `$emit('selectGenre', value)` |
| 親で受け取るときの属性 | kebab-case | `@select-genre="handleSelectGenre"` |

覚え方: **JavaScript の中は camelCase、HTMLとして書く場所は kebab-case。**

### 具体例

子（`RouteConditionForm.vue`）:

```vue
<script setup>
defineProps({
  genre: { type: String, default: null }
});

defineEmits(['selectGenre']);
</script>

<template>
  <button @click="$emit('selectGenre', option.value)">...</button>
</template>
```

親（`RouteConditionView.vue`）:

```vue
<RouteConditionForm
  :genre="routeStore.genre"
  @select-genre="routeStore.selectGenre"
/>
```

---

## Composable 利用方針

### 使うべきタイミング

- 2つ以上のコンポーネントで同じロジックを使う場合
- 1つのコンポーネント内でもロジックが複雑で切り出すと可読性が上がる場合
- API呼び出し・状態管理・副作用のあるロジック

### Composable のルール一覧

| ルール | 理由 |
|---|---|
| `use` プレフィックスを必ずつける | 一目で composable と分かる |
| 戻り値はオブジェクトで返す | 分割代入で必要なものだけ受け取れる |
| リアクティブな値は `ref` / `reactive` で返す | テンプレートで自動追跡される |
| composable 内で別の composable を呼んでよい | 組み合わせで再利用性を高める |
| DOM操作は行わない | 関心の分離 |
| コンポーネント固有のUI状態は composable に含めない | 汎用性を保つ |

---

## コンポーネント間のデータフロー

- データは上から下（props）
- イベントは下から上（emit）
- 兄弟間の通信は親を経由するか、composable / store を使う
- 複数画面をまたぐ状態は Pinia（`stores/`）で持つ

ミチシルでは検索条件（目的・ジャンル・距離）と生成済みルートが画面をまたぐため、`stores/routeStore.js` で保持する。

---

## スタイル

| ルール | 詳細 |
|---|---|
| コンポーネント固有のスタイルは `<style scoped>` に書く | 他コンポーネントへの影響を防ぐ |
| 全画面共通のスタイルのみ `assets/styles/global.css` に置く | 重複を避ける |
| クラス名は kebab-case | `route-card`, `select-btn` |
| 状態を表すクラスは `is-` プレフィックス | `is-selected`, `is-active`, `is-disabled` |

状態クラスは単体で使わず、必ず対象クラスと併用する。

```vue
<button class="select-btn" :class="{ 'is-selected': genre === option.value }">
```

---

## アクセシビリティ

| ルール | 詳細 |
|---|---|
| 選択状態のボタンには `aria-pressed` を付ける | 支援技術に状態を伝える |
| 動的に変わるメッセージには `role="status"` を付ける | 変化を読み上げさせる |
| ボタンには必ず `type` を指定する | フォーム内での誤送信を防ぐ |
| アイコンのみのボタンには `aria-label` を付ける | 何のボタンか伝える |

---

## やってはいけないこと

| NG | 理由 | 代替 |
|---|---|---|
| 子から親の state を直接変更する | 追跡困難・バグの温床 | emit で通知する |
| 1コンポーネントに API 呼び出し + 表示 + バリデーション | 肥大化する | composable と service に分離 |
| props のバケツリレー（3階層以上） | 可読性低下 | composable または store |
| composable 内で `this` を使う | Composition API では不要 | ref/reactive で状態管理 |
| `$parent` / `$refs` で親子を直接操作 | 密結合になる | props/emit を使う |
| `App` プレフィックスを使う | `App.vue` と混同する | `Base〇〇` または `〇〇Layout` |
| props も emit も camelCase だけで書く | テンプレート側では動かない | 上の対応表に従う |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | `App` プレフィックスを廃止 / props と emit の大文字小文字の対応表を追加 / 名前と置き場所の対応を明記 / スタイル・アクセシビリティの節を追加 / 用語を辞書に合わせて更新（`WaypointPin` → `SpotPin` 等） |
