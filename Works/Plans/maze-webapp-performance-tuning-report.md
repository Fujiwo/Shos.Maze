# Maze Web App Performance Tuning Report

## 1. 文書概要
- 作成日: 2026-03-25
- 対象リポジトリ: Shos.Maze
- 対象範囲: Maze Forge: Generator & Pathfinding Explorer の大規模迷路向け高速化

本書は、過去に実施したパフォーマンス チューニングの内容を事後記録として整理したものである。
本書は新規計画ではなく、実施済み内容の要約に限定する。

## 2. 背景
高速化の主目的は、特に Hard から Super Hard、なかでも 201 x 201 の迷路サイズにおいて、以下の問題を抑制することだった。

- 迷路生成時のメインスレッド負荷
- 探索時の描画コスト増大
- リサイズや進行アニメーション中の再描画負荷
- 大量セル描画に伴う UI 応答低下

## 3. 実施した高速化
### 3.1 データ表現の軽量化
- 迷路データを 2 次元配列表現から、cellId ベースの 1 次元配列表現へ統一した
- mazeGrid を `Uint8Array` ベースで扱う構成へ寄せた
- visitedOrder と shortestPath を typed array ベースで管理する構成へ整理した
- visitedOrder は必要に応じて拡張する `Int32Array` バッファ方式にした

主な対象ファイル:
- Sources/js/app-state.js
- Sources/js/worker/worker-algorithms.js

### 3.2 描画コストの削減
- 迷路の静的部分を別 canvas にキャッシュし、毎回の全面再描画を避ける構成を導入した
- 探索済みセルと最短経路は、前回描画との差分のみを追加描画する方式にした
- リサイズ時または迷路変更時のみ静的レイヤーを再構築するようにした
- `requestAnimationFrame` ベースの render scheduler を導入し、短時間の複数描画要求を 1 フレームへ集約した

主な対象ファイル:
- Sources/js/render-canvas.js
- Sources/js/render-scheduler.js

### 3.3 座標計算の事前キャッシュ
- 各 cellId に対応する描画座標を事前計算し、描画時の row / col 算出を避けた
- start / goal マーカー用の inset 座標も事前計算した
- リサイズまたは gridSize 変更時のみ座標キャッシュを再生成するようにした

主な対象ファイル:
- Sources/js/render-canvas.js

### 3.4 バッチ描画と Path2D 利用
- Path2D が利用可能な環境では、壁、通路、探索済みセル、最短経路をまとめて描画する方式を導入した
- Path2D 非対応環境では `fillRect` にフォールバックする実装にした
- 大量セルの逐次描画回数を減らし、Super Hard での描画負荷を軽減した

主な対象ファイル:
- Sources/js/render-canvas.js

### 3.5 Worker への計算オフロード
- 迷路生成と経路探索の重い処理を Web Worker 側へ移動した
- メインスレッドは UI 制御と描画に集中させる構成へ変更した
- Worker 未対応環境では graceful degradation として失敗扱いにし、UI 破綻を避けるようにした

主な対象ファイル:
- Sources/js/worker-request-client.js
- Sources/js/worker-bootstrap.js
- Sources/js/worker/worker-algorithms.js

### 3.6 探索進行通知のバッチ化
- 探索済みセルの進捗通知を 1 セル単位ではなく batch 単位で送る方式にした
- 難易度別に workerBatchSize と pathBatchSize を分け、描画テンポと応答性のバランスを調整した
- Worker 側でも一定回数ごとに制御を返し、長時間占有を避ける構成にした

主な対象ファイル:
- Sources/js/app-config.js
- Sources/js/worker/worker-algorithms.js

### 3.7 探索アルゴリズム側の補助最適化
- A* の open set を heap ベースで管理する構成を採用した
- `cameFrom`、`gScore`、`closedSet` を typed array で保持する方式にした
- Manhattan distance を cellId から直接算出する構成へ整理した

主な対象ファイル:
- Sources/js/worker/worker-heap.js
- Sources/js/worker/worker-algorithms.js

### 3.8 stale request の抑制
- generate / solve の requestId を管理し、古い request の結果を UI 側へ反映しないようにした
- 新しい要求開始時に既存 request を cancel する方式を導入した
- 高速な difficulty 変更時でも、不要な古い生成結果で画面が揺り戻されないようにした

主な対象ファイル:
- Sources/js/worker-request-client.js
- Sources/js/app-controller.js

## 4. 結果
今回の高速化により、少なくとも設計上および現行実装上、以下の改善を実現した。

- Super Hard サイズでも迷路全体を画面内へ収めたまま処理できる構成になった
- 描画のボトルネックを静的レイヤーキャッシュと差分描画で軽減した
- 計算負荷の大きい生成と探索を Worker 側へ分離し、UI 応答性を改善した
- リサイズ時に迷路再生成や再探索を行わず、保持済み状態から再構築できる構成になった
- rapid difficulty change や進行中操作に対する stale request 問題を抑制した

## 5. 検証状況
数値ベンチマークの記録は本チューニング時点では残していない。
ただし、その後の E2E テスト整備および現行実装確認により、以下は確認済みである。

- Hard / Super Hard を含む通常動作が回帰していないこと
- request cancel と UI ロックが維持されていること
- Worker 未対応時にも UI が破綻しないこと
- 主要 E2E テストが通過していること

## 6. 関連ファイル
- Sources/js/app-config.js
- Sources/js/app-state.js
- Sources/js/app-controller.js
- Sources/js/render-scheduler.js
- Sources/js/render-canvas.js
- Sources/js/worker-request-client.js
- Sources/js/worker-bootstrap.js
- Sources/js/worker/worker-heap.js
- Sources/js/worker/worker-algorithms.js

## 7. 補足
本レポートは、リファクタリング後の現行ファイル構成に合わせて整理している。
そのため、当時の作業順序や途中の暫定実装を完全に再現するものではなく、最終的に残った高速化施策を中心に記録している。