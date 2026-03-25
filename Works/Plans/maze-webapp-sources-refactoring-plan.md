# Maze Web App Sources Refactoring Plan

## 1. 目的とスコープ
本計画書は、Sources 配下のフロントエンド実装を保守しやすい責務単位へ整理するためのリファクタリング方針を定義するものである。

本書は事後記録であるが、計画書の形式で以下を整理する。
- どの責務をどの単位へ分割するか
- どの命名規則で統一するか
- どの順番で段階的に変更するか
- どのように挙動を維持しながら整理するか

機能追加や UI 要件変更は本計画の直接対象ではない。

## 2. 背景
初期実装では Sources/main.js に、以下の責務が集中していた。
- 定数定義
- 状態管理
- DOM 取得とイベント束縛
- UI 同期
- 描画ロジック
- Worker 通信
- アプリ全体の制御

この構成では、命名整理、性能改善、バグ修正のたびに変更範囲が広くなり、以下の問題があった。
- 可読性が低い
- 依存関係が見えづらい
- 変更影響範囲が広い
- 再利用しにくい
- ランタイム不具合時の切り分けが難しい

## 3. リファクタリングの目標
- 責務ごとにファイルを分離すること
- classic script の制約下でも読み込み順が理解しやすい構成にすること
- app、ui、render、worker の層が名前から分かること
- bootstrap、controller、request client、message protocol などの役割が名前から分かること
- 動作を維持しながら段階的に移行すること

## 4. 設計方針
### 4.1 層分割方針
Sources 配下を以下の責務層に分ける。

- protocol
  - Worker と main thread 間のメッセージ種別定義
- app
  - 設定、状態、タイミングなどアプリ横断の基盤
- ui
  - DOM 取得、イベント束縛、状態の UI 反映
- render
  - canvas 描画および描画スケジューリング
- worker
  - Worker 通信クライアントと Worker 実行側処理
- startup
  - controller と bootstrap

### 4.2 命名方針
ファイル名と公開名をできる限り一致させ、責務が推測できる命名に統一する。

例:
- js/app-config.js / MazeAppConfig
- js/ui-dom.js / MazeUiDom
- js/render-canvas.js / MazeRenderCanvas
- js/worker-request-client.js / MazeWorkerRequestClient
- js/worker-message-protocol.js / MazeWorkerMessageProtocol

### 4.3 実行モデル方針
- ブラウザ側は classic script と defer を継続利用する
- Worker 側は importScripts を継続利用する
- 依存順は index.html と worker-bootstrap.js で明示する

## 5. 段階的実施計画
### 5.1 Phase 1: 定数、状態、描画の分離
目的:
- main.js の巨大化を抑える
- 変更頻度の高い責務を独立させる

対象:
- constants 相当の切り出し
- app-state の切り出し
- renderer の切り出し

想定成果物:
- js/app-config.js
- js/app-state.js
- js/render-canvas.js

### 5.2 Phase 2: UI 関連の分離
目的:
- DOM 操作と UI 表示ロジックを controller から分離する

対象:
- 要素取得
- イベント束縛
- UI 反映

想定成果物:
- js/ui-dom.js
- js/ui-sync.js

### 5.3 Phase 3: Worker 通信の分離
目的:
- request 発行とレスポンス受信を controller から分離する
- Worker 側メッセージ規約を 1 箇所に集約する

対象:
- request client の切り出し
- message protocol の切り出し
- worker bootstrap と worker helper の整理

想定成果物:
- js/worker-request-client.js
- js/worker-message-protocol.js
- js/worker-bootstrap.js
- js/worker/worker-heap.js
- js/worker/worker-messages.js
- js/worker/worker-algorithms.js

### 5.4 Phase 4: 起動層の整理
目的:
- AppController と bootstrap を分離する
- 起動順序の見通しを改善する

対象:
- AppController 本体の切り出し
- main.js を bootstrap 相当へ縮小

想定成果物:
- js/app-controller.js
- js/app-bootstrap.js

### 5.5 Phase 5: 命名の統一
目的:
- request-oriented な語彙に揃える
- 機能名ではなく責務名で読める構成にする

対象:
- request lifecycle 名称の整理
- request result 名称の整理
- request progress 名称の整理
- request failure 名称の整理

例:
- startGenerateRequest
- handleSolveRequestProgress
- applyGenerateRequestResult
- postSolveRequestResult
- runGenerateRequest

## 6. 最終想定ファイル構成
### 6.1 Sources 直下
- index.html
- style.css
- favicon.svg

### 6.2 Sources/js
- worker-message-protocol.js
- app-config.js
- app-state.js
- app-timing.js
- ui-dom.js
- ui-sync.js
- render-scheduler.js
- render-canvas.js
- worker-request-client.js
- app-controller.js
- app-bootstrap.js
- worker-bootstrap.js

### 6.3 Sources/js/worker
- worker-heap.js
- worker-messages.js
- worker-algorithms.js

## 7. 読み込み順の計画
index.html における script 読み込み順は責務順で固定する。

1. protocol
2. app
3. ui
4. render
5. worker request client
6. app controller
7. app bootstrap

js/worker-bootstrap.js における importScripts の順序は以下とする。

1. worker-message-protocol.js
2. worker/worker-heap.js
3. worker/worker-messages.js
4. worker/worker-algorithms.js

## 8. 変更時の制約
- public API の意味を大きく変えないこと
- 各段階で静的診断を通すこと
- 大きな rename と責務分離を同時にやり過ぎないこと
- Worker と main thread のメッセージ形式を段階ごとに壊さないこと
- 実装ロジック変更ではなく構造整理を優先すること

## 9. 検証方針
### 9.1 静的確認
- 参照切れがないこと
- script 読み込み順が依存を満たすこと
- importScripts の対象が実在すること

### 9.2 実行確認
- 初回ロードで例外が出ないこと
- Generate Maze が動作すること
- Start Exploration が動作すること
- Worker が正常に起動すること

## 10. 想定される効果
- 変更責務の切り分けが容易になる
- バグ発生時の調査対象が狭まる
- 命名から依存と役割を把握しやすくなる
- 今後のテスト導入や追加分割がしやすくなる

## 11. リスクと対策
### 11.1 リスク
- rename に伴う参照漏れ
- classic script 特有の読み込み順不整合
- Worker の importScripts パス不整合
- window/self 公開名の不一致

### 11.2 対策
- 段階的に rename を行う
- 各段階で静的診断を行う
- index.html と js/worker-bootstrap.js を依存順の単一ソースとして扱う
- 役割名と公開名を揃える

## 12. 完了条件
- Sources/js 配下の主責務が責務別ファイルへ分離されていること
- ファイル名と公開名が概ね一致していること
- index.html の読み込み順が責務順で整理されていること
- worker 側の補助ファイル群が役割単位に分割されていること
- main thread と Worker 双方で request-oriented な語彙が統一されていること

## 13. 実施結果の要約
本計画に沿う形で、Sources/js 配下は責務別構成へ整理された。

主な到達点は以下。
- AppController と bootstrap の分離
- app、ui、render、worker の層分離
- Worker helper 群の分離
- request-oriented な命名規則への統一
- index.html の責務順読み込み構成への整理

今後はこの構成を前提に、ランタイムテストの整備と回帰防止強化を進めるのが望ましい。