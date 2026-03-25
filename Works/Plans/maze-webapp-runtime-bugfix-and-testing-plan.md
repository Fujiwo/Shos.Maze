# Maze Web App Runtime Bug Fix and Testing Plan

## 1. 目的とスコープ
本計画書は、Maze Forge: Generator & Pathfinding Explorer において発生している実行時エラーを安定的に解消し、同種の不具合の再発を防ぐためのテスト基盤を整備するための作業方針を定義するものである。

今回のスコープは以下の 2 点に限定する。
- 実行時エラーの再現、原因特定、修正
- 修正内容を継続検知できるテストの導入

新機能追加、UI デザイン変更、大規模な再設計は本計画の対象外とする。

## 2. 背景
現行の Sources 配下は、単一ファイル構成から責務別ファイル構成へ段階的にリファクタリングされている。

この構成変更により保守性は向上した一方で、以下のような実行時リスクが高くなっている。
- classic script の読み込み順依存
- window および self に公開する名前の整合依存
- Worker 起動ファイルと Worker 補助モジュール間の参照整合依存
- request-oriented な命名変更に伴う呼び出し追従漏れ

このため、静的診断だけでは検出できないブラウザ実行時の不整合が残る可能性がある。

## 3. 解決したい課題
### 3.1 主課題
- 初回ロード時の JavaScript 実行エラーを解消すること
- Generate Maze 実行時のエラーを解消すること
- Start Exploration 実行時のエラーを解消すること

### 3.2 副課題
- Worker の起動失敗やメッセージ連携不整合を早期検知できるようにすること
- 今後の命名整理やファイル分割がランタイムを壊した場合に自動で気付ける状態を作ること

## 4. 原因仮説
実行時エラーの一次仮説は以下とする。
- script 読み込み順と依存順のずれ
- window.MazeAppController などの公開名不整合
- Worker 側 importScripts 対象と実ファイル名の不一致
- request-oriented に改名したメソッド名や関数名の追従漏れ
- DOM 要素取得タイミングと初期化タイミングの不整合

## 5. テスト方針
### 5.1 優先方針
最初に導入するのは unit test ではなくブラウザ実行ベースのスモークテストとする。

理由は以下。
- 問題領域が DOM、global、Worker、script load order にまたがっている
- static analysis や純粋関数テストだけでは実行時不整合を取り切れない
- ページ全体を実行した方が今回の不具合検知に直結する

### 5.2 テスト手段
E2E ないしブラウザ統合テストには Playwright を第一候補とする。

採用理由は以下。
- ブラウザコンソールエラーの取得が容易
- DOM 状態遷移の検証が容易
- Worker を含む実ブラウザ挙動を検証しやすい
- 今後の回帰テスト拡張がしやすい

## 6. 導入するテストの最小セット
### 6.1 スモークテスト
最初に追加するテストケースは以下とする。

1. ページロードで致命的な console error が出ないこと
2. 初期表示後に Difficulty と主要ボタンが描画されること
3. 初期表示後に自動生成が完了し、Status が Ready へ遷移すること

### 6.2 操作テスト
次に以下を追加する。

1. Generate Maze 実行でエラーなく再生成されること
2. Start Exploration 実行で探索が進行し、Visited Cells が増加すること
3. 探索完了後に Path Highlighted まで到達すること

### 6.3 回帰テスト
不具合原因に応じて以下から必要最小限を追加する。
- Worker bootstrap の読み込み失敗を検知するテスト
- Difficulty 変更後に新しい generate request が開始されることの確認
- 旧 request の進捗が新 request の表示を壊さないことの確認

## 7. 作業手順
### 7.1 Phase 1: 再現と観測
- ローカルでアプリを起動し、初回ロード時の console error を採取する
- Generate Maze 実行時の挙動を記録する
- Start Exploration 実行時の挙動を記録する
- エラーメッセージ、発生タイミング、発生ファイルを記録する

成果物:
- 再現手順
- 発生条件
- 代表的なエラーログ

### 7.2 Phase 2: テスト基盤導入
- package.json を追加する
- Playwright を導入する
- ローカル実行用の最小構成を整える
- Sources/index.html を対象にスモークテストを追加する

実行コマンド例:
- npm install
- npx playwright install chromium
- npm run test:e2e
- npm run test:e2e:headed
- npm run test:e2e:debug

成果物:
- テスト実行コマンド
- 初期スモークテスト一式

### 7.3 Phase 3: 原因修正
- エラー原因を 1 件ずつ修正する
- 各修正後にスモークテストを実行する
- 修正範囲を最小に保つ

対象ファイル候補:
- Sources/index.html
- Sources/app-bootstrap.js
- Sources/app-controller.js
- Sources/worker-request-client.js
- Sources/worker-bootstrap.js
- Sources/worker/worker-messages.js
- Sources/worker/worker-algorithms.js

### 7.4 Phase 4: 回帰防止強化
- 発見された原因に対応する回帰テストを追加する
- 主要ユースケースを壊していないことを確認する
- 不具合再発時に失敗箇所が分かる粒度までテストを整える

## 8. テスト観点
### 8.1 初期化
- script 読み込み順が正しいこと
- bootstrap 時に必要な公開名が存在すること
- AppController 初期化が例外なく完了すること

### 8.2 Worker 連携
- Worker が起動できること
- generate request が送受信できること
- solve request が送受信できること
- failure メッセージが適切に UI 側へ伝播すること

### 8.3 UI 状態遷移
- generating 中に操作ロックが機能すること
- exploring 中に visited count が更新されること
- highlighting 中に操作ロックが機能すること
- completed 後に再生成可能であること

## 9. 成果物
- ランタイム不具合の原因調査メモ
- ランタイム不具合の修正コード
- Playwright ベースのスモークテスト
- 必要最小限の回帰テスト
- テスト実行手順の簡易メモ

## 10. 完了条件
- 初回ロード時に console error が発生しないこと
- Generate Maze と Start Exploration が実行時エラーなく完了すること
- 追加したスモークテストが安定して通過すること
- 原因に対応した回帰テストが追加されていること

## 11. リスクと対策
### 11.1 リスク
- Worker を含むブラウザ依存挙動がローカル環境差で不安定になる可能性
- classic script ベースのため依存関係が暗黙的になりやすい
- テスト導入時に配信方法や static server の準備が必要になる可能性

### 11.2 対策
- 最初は最小のスモークテストに絞る
- 原因不明のまま広範囲改修しない
- 1 修正ごとにテストを回して影響範囲を限定する

## 12. 実施順序の要約
1. 実行時エラーを再現する
2. スモークテスト基盤を導入する
3. 原因を最小修正で解消する
4. 回帰テストを追加する
5. 安定化を確認して完了とする

## 13. 実施結果
### 13.1 テスト基盤の追加結果
- package.json を追加し、Playwright ベースの E2E 実行環境を整備した
- playwright.config.js を追加し、Sources を配信対象とするローカル実行構成を整えた
- Tests/e2e/maze-runtime.spec.js を追加し、初回ロード、再生成、探索完了のスモークテストを整備した
- Tests/support/static-server.js を追加し、warning の出る http-server 依存を廃止して独自静的サーバーへ置き換えた

### 13.2 追加した回帰テスト
追加済みの回帰テストは以下。
- Worker 非対応環境でもページ全体がクラッシュせず、graceful degradation すること
- favicon 読み込み時に 404 を出さず、ブラウザ資源読込エラーを増やさないこと
- Difficulty を短時間で連続変更したときに stale request が cancel され、最後に選択した難易度の generate request へ収束すること

### 13.3 実際に特定した実行時エラー
今回の観測で、以下の実行時エラーを確認した。
- Worker 非対応環境で new Worker に到達した場合の初期化失敗
- 初回ロード時に favicon.ico が存在しないことによる 404 エラー

### 13.4 実施した修正
- Sources/worker-request-client.js に Worker 非対応時の graceful degradation を追加した
- Sources/index.html に favicon.svg の明示設定を追加した
- Sources/favicon.svg を追加し、初回ロード時の favicon 404 を解消した

### 13.5 実行結果
ローカル環境にて以下を確認した。
- npm run test:e2e が成功
- スモークテストおよび回帰テストを含む E2E テスト群が通過
- 独自静的サーバー使用時に、従来の http-server 由来 warning は発生しない

### 13.6 現在のテスト実行手順
ローカルでの基本手順は以下とする。

1. リポジトリルートで npm install を実行する
2. 初回のみ npx playwright install chromium を実行する
3. 通常確認では npm run test:e2e を実行する
4. ブラウザ表示を見ながら確認したい場合は npm run test:e2e:headed を実行する
5. 詳細デバッグが必要な場合は npm run test:e2e:debug を実行する

期待結果は以下。
- 初回ロード系テストが通過すること
- Generate と Solve のスモークテストが通過すること
- Worker 非対応時の回帰テストが通過すること
- rapid difficulty change 時の request cancel 回帰テストが通過すること