# React / Laravel デファクトスタンダード実装基準

Worknity におけるフロントエンド（React 19 + TypeScript + Vite）およびバックエンド（Laravel 12 + PHP 8.2 + MySQL）のコード品質・保守性・セキュリティを維持するためのデファクトスタンダード基準です。

---

## 1. フロントエンド（React / TypeScript）標準ルール

### 1.1. 責務の分離（View と Logic の分離）
- **カスタムフックへの切り出し (`src/hooks/`)**:
  - コンポーネント（`src/pages/`, `src/components/`）内に複雑な `fetch` 通信、データ変換、楽観的UIのステート管理を直接書き込まない。
  - `useInventory.ts` や `useWorkflow.ts` のように、ドメインごとのカスタムフックにビジネスロジックをカプセル化し、コンポーネントは「表示とイベントのバインド」に専念させる。
- **コンポーネントの肥大化防止（200行目安）**:
  - 1つのコンポーネントファイルが200行を超える場合は、モーダル、テーブル行、入力フォームなどを意味のある単位でサブコンポーネントに分割する。
- **共通UIコンポーネントの再利用 (`src/components/ui/`)**:
  - 生の `<input>` や `<select>` をその都度インラインスタイルで乱造せず、`src/components/ui/` 配下の共通コンポーネント（`Input`, `NumberInput`, `Select`, `Combobox`, `DatePicker`, `TimePicker`, `Switch`, `Checkbox`, `TextArea`）を優先使用する。

### 1.2. 厳格な TypeScript と React Hooks 作法
- **`any` の完全禁止**:
  - `any` 型や安易な `as` キャストを使用しない。APIレスポンスやエンティティの型定義は `src/types/` に集約し、フロント・バックエンド間でスキーマを一致させる。
- **`useEffect` の適切な運用**:
  - レンダー中に計算可能な派生値（フィルタリング結果や合計金額など）のために `useEffect` + `useState` を使わず、`useMemo` または通常の変数計算で求める。
  - イベントハンドラ内で処理すべき副作用を `useEffect` に逃がさない。
- **マジックナンバー・マジック文字列の排除**:
  - ステータス値（`'pending'`, `'approved'` 等）や固定設定値は定数オブジェクトまたはユニオン型として定義する。

### 1.3. 楽観的UI（Optimistic Update）と認証管理
- **ロールバックとのペア実装**:
  - UIを先行更新する場合は、更新前のスナップショットを保持し、APIエラー時に必ず元のステートへ復元（ロールバック）した上でユーザーへエラーを通知する。
  - 通信中は対象ボタンを `disabled` にし、多重送信（連打）を防止する。
- **JWTのメモリ保持**:
  - 通常のユーザー認証JWTは `localStorage` に保存せず、React の Context / State 上でのみ保持する（例外：固定キオスク端末の `kiosk_device_token` のみ設計書仕様に従う）。

### 1.4. Vanilla CSS デザインシステム
- TailwindCSS 等の外部CSSフレームワークは導入せず、`src/index.css` の CSS変数（Custom Properties）とクラス定義を活用する。
- インラインスタイル（`style={{ ... }}`）の多用を避け、再利用可能なクラスまたはCSS変数でテーマ（ダークモード含む）に対応する。

---

## 2. バックエンド（Laravel 12 / PHP 8.2）標準ルール

### 2.1. Thin Controller（スリムなコントローラー）の徹底
- **FormRequest によるバリデーション分離 (`app/Http/Requests/`)**:
  - コントローラー内で `$request->all()` を直接扱ったり、長大な `$request->validate([...])` を記述したりせず、`FormRequest` クラスを作成して型安全に `$request->validated()` を受け取る。
  - バリデーションエラー時は Laravel 標準の `422 Unprocessable Entity` JSON レスポンスを返却する。
- **Service クラスへのビジネスロジック切り出し (`app/Services/`)**:
  - 複数テーブルにまたがる更新、ワークフロー連携、在庫計算などのビジネスロジックは Controller に書かず、`app/Services/` 配下の Service クラスに切り出す。
  - 1メソッドは50行以内を目安とし、単一責任を維持する。

### 2.2. マルチテナント隔離と他テナント存在隠蔽（最優先セキュリティ）
- **テナントスコープの自動適用**:
  - 組織（`organization_id`）に紐づくすべての Eloquent モデルには `App\Traits\Multitenant` トレイト（またはグローバルスコープ）を適用し、クエリおよび作成時に `organization_id` が自動適用されるようにする。
  - `withoutGlobalScopes()` は通常のAPIリクエスト内では絶対に使用しない。
- **他テナントデータへのアクセスは `404 Not Found`**:
  - 別テナントのリソースIDを指定された場合、`403 Forbidden` ではなく必ず `404 Not Found`（`findOrFail()` 等）を返し、データの存在有無を外部から推測させない。

### 2.3. トランザクション・悲観的ロック・パフォーマンス
- **在庫・数値更新時の悲観的ロック**:
  - 入庫・出庫・棚卸・注文確定など、整合性が求められるデータ更新では必ず `DB::transaction()` を使用し、対象レコードを `lockForUpdate()` でロックしてから加減算を行う。
  - 在庫数が `0` 未満になる場合はトランザクション内で `ValidationException`（422）をスローしてロールバックする。
- **N+1 クエリの防止と Mass Assignment 保護**:
  - リレーションを参照する一覧取得APIでは必ず `with([...])` で Eager Loading を行う。
  - すべての Model で `$fillable` を明示的に定義し、`$guarded = []` のような無防備な設定を禁止する。
- **拡張属性の JSON カラム活用**:
  - 業態固有の拡張項目は、安易に物理カラムを増やさず `attributes`（JSON型カラム）を活用する。

