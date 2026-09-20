---
name: lucky-reveal-director
description: Luckyの抽選を物体・構図・音・決着の一つのシーンとして制作し、実際の録画で審査する。
---
# Lucky Reveal Director

対象は明るいルート版のみ。ホームの絵・レイアウト・ナビ・/gentle/は変更しない。
行動入力不要、明示的な表裏/左右選択、50/50、結果後だけ任意メモを維持。
演出に乱数を入れて抽選結果を変えない。自分が選んだカードの同一性を保つ。

## 時間より、見せる出来事
カード17秒、コイン15.5秒。単なる同じ往復やゲージで埋めない。
主役を大きく見せ、物体の位置・状態・角度・構図が段階ごとに変わるようにする。
カードは短いシャッフル、選択カードの引き出し、寄り、角のしなり、開封、余韻。
コインは立ち上がり、接地回転、傾き、倒れ、面の静止。物理計算ではなく演出用キーフレームならそう明記。
結果が現れたカード/コインを消して文章だけに置き換えない。結果後の操作時も物体を残す。
やる/やらないを同じ完成度で作る。やらないを罰や損失として煽らない。
音は明示的に有効化でき、無音でも成立する。ブラウザの無音録画だけで音を聴いたと言わない。
Reduce Motionでも時間は短縮せず、移動・回転・カメラの動きを穏やかにする。

## 制作の役割
`scripts/reveal/make_coin.py`: Blender製のオリジナル硬貨モデル（縁・刻み・両面の凹凸）。
`src/reveal/cinematic.mjs`: Three.jsの紙の厚み/しなり/反射、照明、カメラ、接地、演技。
`public/reveal/`: 同梱済みGLBと描画コード。CDN不要。ライセンスを同梱。
既存Anime.jsは今回変更しない残り3方式に継続使用。ライブラリを入れただけで演出完成としない。

## 審査
機能：ActionsでPRの実コードと本番URLを検証。Chromium/WebKit、通常/Reduce Motion、両結果、実時間、キャンセル、メモ、オフライン。
映像：0.5/3.2/6.5/10.5/12.5秒、開封、余韻、連続の等速録画を取得して見る。
テスト成功や秒数を品質の代わりにしない。文字の上下・欠け、裏面透け、影、接地、空白待ち、物体の大きさを自分で確認する。
Linux WebKitと物理iPhoneを混同しない。変更した方式と未変更の方式を明示する。

参考（公開資料を観察した構成の参考であり、絵・音・モデルの転載ではない）：
- https://www.pokemontcgpocket.com/ja/about/ — 主役に寄って開封する構成
- https://flipsimu.com/ — 物体の面をそのまま答えにする
- https://github.com/LottieFiles/motion-design-skill — 主役・補助・感情・材質
- https://github.com/dylantarre/animation-principles — 準備、動作、余韻
- https://threejs.org/docs/pages/GLTFLoader.html
- https://docs.blender.org/manual/en/5.0/addons/import_export/scene_gltf2.html
