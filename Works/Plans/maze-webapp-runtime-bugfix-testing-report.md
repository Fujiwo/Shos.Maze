# Maze Web App Runtime Bug Fix Testing Report

## 1. 実施情報
- 実施日: 2026-03-25
- 対象リポジトリ: Shos.Maze
- 対象範囲: Sources 配下のランタイム安定化、E2E テスト基盤、回帰テスト追加
- 実行環境:
	- OS: Windows
	- Node.js: v22.16.0
	- npm: 10.9.2
	- Browser: Playwright Chromium
	- Local Server: Tests/support/static-server.js

## 2. 目的
本レポートは、Maze Forge: Generator & Pathfinding Explorer に対して追加したランタイム系テスト基盤、回帰テスト、関連バグフィックスの実施結果を簡潔に記録するものである。

本書は計画書ではなく、実施済み内容の記録に限定する。

## 3. 実施内容
### 3.1 テスト基盤
- Playwright ベースの E2E テスト基盤を追加した
- package.json と playwright.config.js を追加した
- Tests/support/static-server.js を追加し、独自静的サーバーで Sources を配信する構成にした
- 従来の http-server 依存を廃止した

### 3.2 スモークテスト
以下のスモークテストを追加した。
- favicon 読み込み成功
- 初回ロード正常化
- Generate 実行正常化
- Solve 実行正常化

### 3.3 回帰テスト
以下の回帰テストを追加した。
- Worker 非対応環境でもクラッシュせず graceful degradation すること
- favicon 未設定による 404 を再発させないこと
- Difficulty を短時間で切り替えたとき stale generate request が cancel されること
- Explore 実行中に Generate を連打しても、新しい generate request が発行されず UI 整合性が保たれること
- Explore 実行中に difficulty change を DOM 直操作で強制しても、新しい generate request が発行されず UI 整合性が保たれること

## 4. 実施した修正
- Sources/js/worker-request-client.js に Worker 非対応時の防御処理を追加した
- Sources/index.html に favicon.svg の link 設定を追加した
- Sources/favicon.svg を追加した
- Sources/js/app-controller.js に、generating、exploring、highlighting 中の difficulty change を無効化する防御処理を追加した

## 5. 現在の確認結果
- npm run test:e2e が通過している
- ブラウザ拡張を含まないクリーン環境では、アプリ本体起因の page error と console error は検出されていない
- request cancel と UI ロックの主要動作は E2E で検証済みである

現在の E2E 通過対象:
- favicon 読み込み
- 初回ロード
- Generate
- Solve
- Explore 中の Generate 連打防御
- Explore 中の forced difficulty change 防御
- rapid difficulty change 時の request cancel
- Worker 非対応時の graceful degradation

## 6. 実行コマンド
- npm install
- npx playwright install chromium
- npm run test:e2e
- npm run test:e2e:headed
- npm run test:e2e:debug

## 7. 留意事項
- ユーザー環境で観測された runtime.lastError、content.js、msgport.js 系エラーは、現時点ではブラウザー拡張由来の可能性が高い
- このため、クリーン環境で再現しない限りはアプリ本体不具合としては扱わない

## 8. 次の候補
- Explore 中の difficulty change を強制した場合の防御動作検証
- Worker failure message を UI 表示へ昇格する改善
- CI への E2E 組み込み