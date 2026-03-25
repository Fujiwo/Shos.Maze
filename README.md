# Shos.Maze

ブラウザ上で動作する迷路生成・経路探索可視化アプリです。Sources 配下の HTML / CSS / Vanilla JavaScript で構成されており、迷路生成、A* による探索、最短経路ハイライトをクライアントサイドのみで実行します。

## 概要

Shos.Maze は、Maze Forge: Generator & Pathfinding Explorer として実装されている 2D 迷路 Web アプリです。初期表示時に迷路を自動生成し、Generate Maze で再生成、Start Exploration で探索アニメーションを開始できます。

大規模迷路に対応するため、Canvas 描画、Web Worker による重い計算の分離、差分描画、typed array ベースのデータ管理などの高速化が入っています。

## 主な機能

- 迷路の自動生成
- A* による経路探索の可視化
- 最短経路のハイライト表示
- Difficulty 切り替えによる迷路サイズ変更
- localStorage による Difficulty の保存と復元
- レスポンシブな Canvas 描画
- Web Worker を用いた generate / solve 処理の分離
- Playwright による E2E テスト

現在の Difficulty とグリッドサイズは以下です。

- Easy: 25 x 25
- Normal: 51 x 51
- Hard: 101 x 101
- Super Hard: 201 x 201

## 使用技術

- HTML5
- CSS3
- Vanilla JavaScript ES6+
- Canvas API
- Web Worker
- Node.js
- Playwright

補足:

- アプリ本体はクライアントサイドのみで動作します。
- Node.js はローカル確認用の静的サーバーと E2E テスト実行に使用します。
- 外部フロントエンドライブラリは使用していません。

## ディレクトリ構成

```text
.
├─ Prompts/            プロンプト関連ドキュメント
├─ Sources/            アプリ本体
├─ Specifications/     仕様書
├─ Tests/              Playwright E2E と補助サーバー
├─ Works/Plans/        計画書、検証記録、改善レポート
├─ package.json        テスト用スクリプト定義
└─ playwright.config.js
```

Sources 配下の主な役割は以下です。

- index.html: 画面のエントリポイント
- style.css: UI とレイアウト
- app-controller.js: アプリ全体の状態遷移と操作制御
- render-canvas.js: Canvas 描画
- worker-request-client.js: メインスレッドから Worker への要求管理
- worker-bootstrap.js: Worker 起動入口
- worker/: 迷路生成、探索、優先度付き heap などの Worker 側実装

## 利用方法

### 1. アプリをローカルで確認する

このアプリは Web Worker を利用するため、ローカル確認は静的サーバー経由を前提にしてください。リポジトリにはテストでも使っている簡易サーバーが含まれています。

```bash
node ./Tests/support/static-server.js
```

起動後、ブラウザで以下にアクセスします。

```text
http://127.0.0.1:4173
```

### 2. 基本操作

1. 初期表示後、迷路が自動生成されます。
2. Difficulty でサイズを切り替えます。
3. Generate Maze で現在の Difficulty の迷路を再生成します。
4. Start Exploration で探索アニメーションを開始します。
5. 探索完了後、最短経路がハイライト表示されます。

## 開発とテスト

### 依存関係のインストール

```bash
npm install
```

初回のみ Playwright のブラウザをインストールしてください。

```bash
npx playwright install chromium
```

### E2E テスト実行

```bash
npm run test:e2e
```

表示を見ながら確認する場合:

```bash
npm run test:e2e:headed
```

デバッグ実行:

```bash
npm run test:e2e:debug
```

現在の E2E では主に以下を確認しています。

- 初回ロードの正常化
- favicon 読み込み
- Generate の正常動作
- Solve の正常動作
- rapid difficulty change 時の stale request 抑制
- Explore 中の Generate 連打防御
- Explore 中の difficulty change 防御
- Worker 非対応時の graceful degradation

## 補足

- 仕様書は Specifications 配下にあります。
- 開発計画、リファクタリング記録、性能改善記録、ランタイム修正とテスト記録は Works/Plans 配下にあります。
- パフォーマンス改善では、1 次元 cellId 表現、typed array、静的レイヤーキャッシュ、差分描画、Path2D、Worker オフロード、request cancel が導入されています。
