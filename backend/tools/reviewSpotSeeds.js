/**
 * @description テスト用の口コミの場所（大手町ビル周辺）の元データ。
 * 投入は tools/seedReviewSpots.js が行う。座標・評価・投稿者はスクリプトが
 * 決まった乱数で生成するため、ここには名前とジャンルだけを持つ。
 *
 * 名前は架空の「こういう場所あるよね」という言い回しにし、
 * 実在の店名・施設名は使わない（実在の場所と誤解されないようにする）。
 * ロケーション名の上限（30文字）に収める。
 */

/** 投入する範囲。大手町ビル（千代田区大手町1-6-1）を中心に、皇居の堀にかからない東側へ広げる */
export const SEED_AREA = {
  /** 大手町ビルのおおよその位置 */
  center: { lng: 139.7647, lat: 35.6866 },
  /** 西端。これより西は皇居の堀・敷地になり、徒歩で到達できない場所が混ざるため避ける */
  minLng: 139.762,
  maxLng: 139.77,
  minLat: 35.6815,
  maxLat: 35.6925
};

/** ジャンルIDと表示名（検索条件マスタの genreId / genreName と揃える） */
export const SEED_GENRES = {
  nature: '自然',
  photo: '写真',
  history: '歴史',
  gourmet: 'グルメ'
};

/** テスト用の口コミの場所の名前とジャンル */
export const REVIEW_SPOT_SEEDS = [
  // 自然
  { name: 'ビルの谷間で光合成できる芝生', genreId: 'nature' },
  { name: 'カルガモ親子に会えたら勝ちの堀端', genreId: 'nature' },
  { name: '昼休みに鳩と目が合う植え込み', genreId: 'nature' },
  { name: '風が抜けすぎて前髪が終わる並木道', genreId: 'nature' },
  { name: 'ベンチの日なたが争奪戦の小広場', genreId: 'nature' },
  { name: '都会のど真ん中で蝉が本気を出す木', genreId: 'nature' },
  { name: '雨上がりに土の匂いがする小道', genreId: 'nature' },
  { name: '謎に手入れが完璧すぎる花壇', genreId: 'nature' },
  { name: '夕方だけ木漏れ日が映える歩道', genreId: 'nature' },
  { name: 'ビル風に負けないど根性の街路樹', genreId: 'nature' },
  { name: 'ランチ後の昼寝に最適な木陰', genreId: 'nature' },
  { name: '水の音で仕事の疲れが溶ける噴水', genreId: 'nature' },
  { name: '秋に銀杏の香りが攻めてくる通り', genreId: 'nature' },

  // 写真
  { name: '地下通路で必ず迷子になる入口', genreId: 'photo' },
  { name: 'スーツの人波をぼんやり眺める交差点', genreId: 'photo' },
  { name: '夜景がやたらエモい歩道橋', genreId: 'photo' },
  { name: 'ガラス張りに空が映るビルの足元', genreId: 'photo' },
  { name: '映画のロケっぽさ満点の石畳', genreId: 'photo' },
  { name: '自販機のラインナップが攻めてる角', genreId: 'photo' },
  { name: 'エスカレーターが長すぎる地下広場', genreId: 'photo' },
  { name: '雨でも濡れずに歩ける最強ルート', genreId: 'photo' },
  { name: '早朝だけ誰もいない静かな広場', genreId: 'photo' },
  { name: 'ビルの隙間から月が見える場所', genreId: 'photo' },
  { name: '撮ると妙に映えるレンガ風の壁', genreId: 'photo' },
  { name: '信号待ちで考え事がはかどる角', genreId: 'photo' },
  { name: '休日だけ時間がゆっくり流れる広場', genreId: 'photo' },

  // 歴史
  { name: '古い石垣っぽい何かが残る坂', genreId: 'history' },
  { name: '明治の香りがする気がする門', genreId: 'history' },
  { name: '昔は川だった気がする細い道', genreId: 'history' },
  { name: '由来を調べたくなる謎の石碑', genreId: 'history' },
  { name: 'レトロな看板が残るビルの裏口', genreId: 'history' },
  { name: '時代劇に出てきそうな路地', genreId: 'history' },
  { name: '昭和の公衆電話が生き残る角', genreId: 'history' },
  { name: '古いタイル装飾が渋いビルの入口', genreId: 'history' },
  { name: '江戸の人も歩いたかもしれない橋のたもと', genreId: 'history' },
  { name: '案内板を読み込むと時間が溶ける場所', genreId: 'history' },
  { name: '重厚な柱に圧倒されるビルの玄関', genreId: 'history' },
  { name: '歴史好きが急に早口になる交差点', genreId: 'history' },
  { name: '古地図アプリと一緒に歩きたい通り', genreId: 'history' },

  // グルメ
  { name: '行列の長さで美味しさがわかるランチ', genreId: 'gourmet' },
  { name: 'カレーの匂いに抗えない路地', genreId: 'gourmet' },
  { name: '揚げたてコロッケの誘惑がすごい角', genreId: 'gourmet' },
  { name: '午後3時に甘い物が欲しくなる店先', genreId: 'gourmet' },
  { name: 'キッチンカーが日替わりで来る広場', genreId: 'gourmet' },
  { name: 'コーヒーの香りで目が覚める通り', genreId: 'gourmet' },
  { name: 'ご飯おかわり自由が神な定食屋', genreId: 'gourmet' },
  { name: '立ち食いそばで秒速ランチの駅前', genreId: 'gourmet' },
  { name: 'パンの焼き上がり時間を狙う道', genreId: 'gourmet' },
  { name: 'ラーメンの湯気で冬でも温かい横丁', genreId: 'gourmet' },
  { name: 'おにぎりの具が選べすぎて迷う売店', genreId: 'gourmet' },
  { name: '夕方にちょい飲みしたくなる路地', genreId: 'gourmet' },
  { name: 'デザートが別腹すぎるカフェの前', genreId: 'gourmet' }
];
