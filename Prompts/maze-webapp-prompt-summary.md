# Shos.Maze Prompt Summary

## 1. 文書の目的
本書は、Shos.Maze リポジトリで実際に使ってきたプロンプトを整理し、再利用しやすい形でまとめるためのリポジトリ内メモである。

本書は `Prompts/maze-webapp-prompt.md` を置き換えるものではない。
初期計画フェーズで使用した元プロンプトは、そのまま保持する。

## 2. プロンプト分類
本リポジトリで使ってきたプロンプトは、主に以下の分類に整理できる。

1. 開発計画作成プロンプト
2. 仕様書作成・改訂プロンプト
3. 実装プロンプト
4. 仕様適合レビューと修正プロンプト
5. パフォーマンス チューニング プロンプト
6. リファクタリング プロンプト
7. ランタイム不具合修正とテスト導入プロンプト
8. 仕様差分レビュー プロンプト
9. ソースコード可読性改善プロンプト

## 3. 既存プロンプトファイル
### 3.1 初期計画プロンプト
- ファイル: `Prompts/maze-webapp-prompt.md`
- 役割:
  - ブラウザ上で動作する 2D 迷路生成・探索可視化アプリの初期開発計画を作る
  - 要件整理、設計方針、アルゴリズム候補、レスポンシブ方針、作業分解を定義する

### 3.2 ソースコメント追加プロンプト
- ファイル: `Prompts/sourcecode-comment-prompt.md`
- 役割:
  - `Sources` 配下に英語コメントを追加し、可読性を高める
  - file responsibility、状態遷移、パフォーマンス上の意図、Worker 連携などを説明する

## 4. 実際に使ったプロンプトの要約
以下は、このリポジトリで実際に有効だったプロンプトの型を要約したものである。

### 4.1 開発計画作成プロンプト
#### 目的
実装前に、迷路 Web アプリ全体の開発計画を固める。

#### 主な意図
- クライアントサイドのみで完結する構成を前提にする
- HTML / CSS / Vanilla JavaScript で実装する前提で考える
- `Works/Plans` に日本語の計画書を作る

#### 期待する内容
- 目的とスコープ
- 要件整理
- UI 構成
- 採用アルゴリズムと理由
- 描画方式
- クラスまたは責務分担
- localStorage 方針
- レスポンシブ対応
- アニメーション方針
- テスト観点
- リスクと実装フェーズ分割

### 4.2 仕様書作成プロンプト
#### 目的
計画書を、実装可能な粒度の正式仕様へ落とし込む。

#### 主な意図
- `Specifications` に正式仕様書を作る
- UI、機能、状態遷移、データ、永続化、描画、レスポンシブ、受け入れ基準を明文化する

#### 期待する内容
- 仕様書だけで実装できる粒度
- 明確な状態遷移
- 明確なデータ構造
- 非機能要件
- テスト観点と受け入れ基準

### 4.3 実装プロンプト
#### 目的
仕様書に基づき `Sources` 配下を実装する。

#### 主な意図
- `index.html`、`style.css`、JavaScript ファイル群を作成・更新する
- 迷路生成、探索可視化、localStorage 復元、レスポンシブ canvas 描画を実装する

#### 期待する内容
- 外部ライブラリを使わない
- クライアントサイド完結
- 仕様準拠
- モバイルとデスクトップの両対応

### 4.4 仕様適合レビューと修正プロンプト
#### 目的
実装を仕様と突き合わせ、不一致を見つけて修正する。

#### 主な意図
- `Sources` と `Specifications/maze-webapp-specification.md` を比較する
- 状態管理、UI 挙動、データ表現、失敗時挙動のズレを洗い出す
- 実装修正か仕様更新かを判断する

#### 期待する内容
- 重大度順の指摘
- 具体的なファイル単位の差分
- 最小修正での是正

### 4.5 パフォーマンス チューニング プロンプト
#### 目的
大規模迷路、特に `201 x 201` を扱う際の性能を改善する。

#### 主な意図
- 描画コストを減らす
- メインスレッド占有を減らす
- Super Hard でも操作不能に陥らない構成へ寄せる

#### 実際に使った最適化テーマ
- `cellId` ベースの 1 次元表現
- typed array
- static canvas cache
- diff rendering
- coordinate cache
- Path2D によるバッチ描画
- Worker への generate / solve オフロード
- request cancel と stale result 抑制

### 4.6 リファクタリング プロンプト
#### 目的
単一ファイルに集まっていた責務を、保守しやすい単位へ分割する。

#### 主な意図
- `Sources` を app / ui / render / worker / bootstrap の責務単位へ分ける
- 挙動を変えずに命名と読み込み順を整理する

#### 期待する内容
- runtime behavior を維持する
- 責務分担を明確にする
- 変更影響範囲を狭める

### 4.7 ランタイム不具合修正とテスト導入プロンプト
#### 目的
ブラウザ実行時の不具合を修正し、回帰防止のテスト基盤を整える。

#### 主な意図
- Playwright ベースの E2E テスト基盤を追加する
- load / generate / solve / Worker / request lifecycle の問題を検知できるようにする
- browser extension 由来ノイズをアプリ本体の失敗と分離する

#### 実際に使った検証テーマ
- 初回ロードのスモークテスト
- Generate のスモークテスト
- Solve のスモークテスト
- Worker 非対応時の graceful degradation
- request cancel の検証
- exploring / highlighting 中の強制操作防御
- favicon とリソース読込安定化

### 4.8 仕様差分レビュー プロンプト
#### 目的
最終的に `Sources` をもう一度仕様観点でレビューし、未解消差分が残っていないか確認する。

#### 主な意図
- 実装、最適化、リファクタリング後の最終整合を取る
- 実装修正と仕様更新の境界を整理する

#### 主な確認観点
- 状態の意味と遷移
- UI ロック規則
- エラー時復元
- データ表現
- Worker と描画アーキテクチャの仕様整合

### 4.9 可読性改善プロンプト
#### 目的
コードの意味を変えずに、英語コメントで可読性を高める。

#### 主な意図
- file-level responsibility コメントを入れる
- 非自明ロジックを説明する
- 描画、Worker、rollback、request lifecycle の意図を明示する
- HTML / CSS にも必要最小限の構造コメントを入れる

#### 期待する内容
- 挙動変更なし
- obvious なコメントを避ける
- 保守性重視

## 5. 時系列ログ
以下は、このリポジトリで実際に進んだ prompt ベースの作業の流れを、時系列で整理したものである。

### 5.1 初期計画フェーズ
- 迷路 Web アプリの開発計画を作るためのプロンプトを使用
- `Prompts/maze-webapp-prompt.md` を基に、計画書を `Works/Plans` に作成
- 主眼は要件整理、設計方針、実装フェーズ分割、リスク整理

### 5.2 仕様書作成フェーズ
- 開発計画を正式仕様へ変換するプロンプトを使用
- `Specifications/maze-webapp-specification.md` を作成・更新
- UI、機能、状態遷移、データ、永続化、描画、レスポンシブ、受け入れ基準を明文化

### 5.3 初期実装フェーズ
- `Sources` 配下へ HTML / CSS / JavaScript を実装するプロンプトを使用
- 迷路生成、経路探索、アニメーション、localStorage 復元を実装
- 当初はより単純な構成から開始し、後続作業で改善を進めた

### 5.4 仕様適合修正フェーズ
- 実装を仕様と照合し、足りない点を修正するプロンプトを使用
- generating 状態、探索アニメーション、UI ロック、Difficulty 表示などを段階的に是正

### 5.5 要件変更追従フェーズ
- 難易度の追加やグリッドサイズ変更など、新要件を反映するプロンプトを使用
- `Super Hard` の追加
- タイトル変更
- ステータス領域の上部配置
- ステータスのコンパクト化
- 難易度サイズの `25 / 51 / 101 / 201` への変更

### 5.6 高速化フェーズ
- Super Hard の描画と探索を実用的にするためのパフォーマンス改善プロンプトを使用
- 描画キャッシュ、差分描画、typed array、Worker オフロード、Path2D、request cancel を導入
- 最終的な実施内容は `Works/Plans/maze-webapp-performance-tuning-report.md` に記録

### 5.7 リファクタリングフェーズ
- 巨大化した `Sources` を責務ごとに整理するプロンプトを使用
- app / ui / render / worker / bootstrap の構成へ分離
- 命名の統一、読み込み順の整理、controller と bootstrap の分離を実施
- 内容は `Works/Plans/maze-webapp-sources-refactoring-plan.md` に記録

### 5.8 ランタイム安定化とテスト導入フェーズ
- 実行時エラーの検知と回帰防止のためのプロンプトを使用
- Playwright 導入
- 独自 static server 導入
- Worker 未対応時の graceful degradation 対応
- favicon 404 対応
- request cancel や UI ロックの E2E テスト追加
- 内容は `Works/Plans/maze-webapp-runtime-bugfix-and-testing-plan.md` と `Works/Plans/maze-webapp-runtime-bugfix-testing-report.md` に記録

### 5.9 仕様整合レビューと差分解消フェーズ
- `Sources` を再度仕様観点でレビューするプロンプトを使用
- 生成失敗時の旧迷路維持、データ表現、Worker 前提、責務分割などを仕様へ反映
- その後、実装側にも generate ガード、rollback、idle / ready 整理を反映
- 差分記録は `Works/Plans/maze-webapp-spec-implementation-gap-review.md` に記録

### 5.10 可読性改善フェーズ
- `Sources` 配下へ英語コメントを追加するプロンプトを使用
- JS 先頭の責務コメント、状態遷移、Worker、描画最適化、rollback 意図の説明を追加
- 必要に応じて HTML / CSS に構造コメントを追加
- 実行用プロンプトは `Prompts/sourcecode-comment-prompt.md` に保存

## 6. 再利用用の短いプロンプト雛形
以下は、このリポジトリで再利用しやすい短い雛形である。

### 6.1 計画作成
`Prompts/maze-webapp-prompt.md` をもとに、迷路 Web アプリの具体的な開発計画を作成してください。今回は計画のみで、実装コードは作成しないでください。出力は `Works/Plans` に日本語 Markdown で保存してください。

### 6.2 仕様書作成
迷路 Web アプリの正式仕様書を `Specifications` に作成または更新してください。UI、機能、状態遷移、データモデル、永続化、描画、性能、レスポンシブ、受け入れ基準を含めてください。

### 6.3 実装
現在の仕様書に基づき、迷路 Web アプリを `Sources` 配下に実装してください。Vanilla JavaScript のみを用い、クライアントサイドのみで完結させてください。

### 6.4 仕様レビュー
`Sources` を `Specifications/maze-webapp-specification.md` と照合してレビューしてください。差分があれば重大度順に示し、差分がなければ未解消差分ゼロであることを明示してください。

### 6.5 パフォーマンス改善
`201 x 201` を含む大規模迷路での挙動を改善してください。描画コスト、メインスレッド占有、Worker 活用、request cancel、アニメーション応答性を重点的に見てください。

### 6.6 ランタイムテスト
Playwright ベースの E2E テストを追加または更新し、load / generate / solve / Worker availability / request cancellation / interaction locking を検証してください。拡張由来エラーはアプリ本体由来と分離してください。

### 6.7 ソースコメント追加
`Sources` 配下に高価値な英語コメントを追加してください。最初に計画を立て、すべての JavaScript ファイルへ file responsibility コメントを追加し、状態遷移、Worker、失敗時復元、描画最適化の意図を優先的に説明してください。

## 7. 関連ドキュメント
- `Prompts/maze-webapp-prompt.md`
- `Prompts/sourcecode-comment-prompt.md`
- `Works/Plans/maze-webapp-development-plan.md`
- `Works/Plans/maze-webapp-sources-refactoring-plan.md`
- `Works/Plans/maze-webapp-runtime-bugfix-and-testing-plan.md`
- `Works/Plans/maze-webapp-runtime-bugfix-testing-report.md`
- `Works/Plans/maze-webapp-performance-tuning-report.md`
- `Works/Plans/maze-webapp-spec-implementation-gap-review.md`
- `Specifications/maze-webapp-specification.md`

## 8. 補足
- 初期計画プロンプトは `Prompts/maze-webapp-prompt.md` にそのまま保持する。
- 本書は、既存プロンプトを置き換えるものではなく、リポジトリ内で使ってきたプロンプトを再利用しやすく整理するための補助文書である。