# Maze Web App Spec / Implementation Gap Review

## 概要
本メモは、現行仕様書を実装準拠へ更新した後もなお残る、実装側の未解消差分を記録する。

## 残存差分
### 1. Generate Maze の状態ガード不足
- 仕様上は exploring 中と highlighting 中に Generate Maze を実行不可とする。
- UI 上は無効化されているが、AppController.startGenerateRequest() 自体には状態ガードがない。
- DOM 以外から直接呼び出された場合、仕様上の禁止状態でも生成要求を開始できる。

### 2. 生成失敗時の表示整合性
- 仕様上は生成失敗時に旧迷路と表示済み進行状態を維持し、不整合な表示へ遷移しないことを求める。
- 現実装は失敗時に ready へ戻して UI を selectedDifficulty 基準で再同期するため、旧迷路を保持したまま Difficulty や Grid Size の表示のみが新値へ切り替わる余地がある。

## 対応方針
- 上記 2 件は仕様変更ではなく、AppController および失敗時 UI 同期処理の実装修正で解消すべき差分と判断する。

## 具体的な変更ポイント
### 1. Generate Maze の状態ガード不足
#### 変更対象
- Sources/app-controller.js

#### 変更ポイント
- AppController.startGenerateRequest() の先頭に状態ガードを追加する。
- generating 中、exploring 中、highlighting 中は何も開始せず、既存どおり syncUI() と requestRender() を行うか、少なくとも状態を変えずに return する。
- handleDifficultyChange() にある禁止状態判定と整合する条件へ統一する。

#### 変更意図
- UI 無効化だけでなく、コントローラ層でも状態遷移を防ぐ。
- DOM 外からの click 呼び出しや直接メソッド呼び出しでも仕様を破れないようにする。

### 2. 生成失敗時の表示整合性
#### 変更対象
- Sources/app-controller.js
- 必要に応じて Sources/app-state.js
- 必要に応じて Sources/ui-sync.js

#### 変更ポイント
- 生成開始前に、現在の表示済み迷路と表示用 Difficulty 情報を復元可能な形で保持する。
- Difficulty 変更起点の生成要求では、selectedDifficulty を即時確定値として扱うのではなく、成功時反映用の候補値として扱う設計へ寄せる。
- handleRequestFailed() では、失敗した要求が generating 由来の場合に旧迷路、旧 gridSize、旧 startId、旧 goalId、旧描画進行度、旧 Difficulty 表示と整合する状態へ戻す。
- solve 失敗時は mazeGrid を壊さず、探索開始前の描画状態へ戻す。
- ready へ戻す条件は、復元後の mazeGrid が存在する場合に限定し、迷路未生成時は exploreButton が無効のまま保たれることを確認する。

#### 実装案
- AppController 内に request rollback 用のスナップショットを持つ。
- 生成開始時に以下を保存する。
	- selectedDifficulty
	- gridSize
	- mazeGrid
	- startId
	- goalId
	- visitedOrder
	- visitedCount
	- shortestPath
	- renderedVisitedCount
	- renderedPathCount
	- currentStatus
- Difficulty 変更時は pendingDifficulty のような一時値を導入するか、最低限 rollback 時に selectedDifficulty を元値へ戻す。
- applyGenerateRequestResult() 成功時にのみ selectedDifficulty と gridSize の表示整合が確定するようにする。

## テスト追加ポイント
### 1. Generate 強制呼び出し防止テスト
#### 変更対象
- Tests/e2e/maze-runtime.spec.js

#### 観点
- exploring 中に button.click() の連打だけでなく、document.getElementById("generate-button").click() を強制実行しても generate 要求が増えないこと。
- highlighting 中にも同様に generate 要求が開始されないこと。

### 2. Difficulty 変更後の生成失敗 rollback テスト
#### 変更対象
- Tests/e2e/maze-runtime.spec.js

#### 観点
- 旧 Difficulty が Easy の状態から、Normal へ変更した直後の generate を失敗させる。
- 失敗後に difficulty-text、grid-size-text、difficulty-select、mazeGrid に相当する表示が旧値の Easy / 25 x 25 に戻ること。
- 旧迷路が保持され、exploreButton の可否が旧迷路存在と整合すること。

#### 実現方法候補
- addInitScript() で Worker を差し替え、特定の generate 要求に対して error メッセージを返すテスト用 Worker を注入する。

### 3. 生成ボタン押下時の Worker 未対応環境テストの見直し
#### 変更対象
- Tests/e2e/maze-runtime.spec.js

#### 観点
- Worker 未対応時は初期生成失敗後も UI が壊れないこと。
- その状態で Generate Maze を押しても、旧迷路がない場合は ready 表示だけで誤解を生まないこと、または状態表示仕様に合わせて期待値を調整すること。

## 実装修正の手順
1. AppController に禁止状態ガードを追加する。
2. rollback 用スナップショットの保持場所を AppController へ追加する。
3. 生成開始前と探索開始前のスナップショット取得を実装する。
4. handleRequestFailed() を generating / exploring で分岐し、復元処理を追加する。
5. 必要なら selectedDifficulty の即時反映を pending 方式へ調整する。
6. Playwright テストを追加し、失敗系を再現する。

## 実装修正前の判断メモ
- 変更の中心は Sources/app-controller.js になる見込み。
- state へ rollback 用フィールドを常設するより、AppController の内部プロパティとして保持したほうが既存描画 API への影響は小さい。
- selectedDifficulty の扱いは UI 表示と保存タイミングに関わるため、最初に rollback 方式で吸収できるかを試し、難しければ pendingDifficulty 導入を検討する。