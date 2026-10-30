# APIインターフェース定義書

本書は、ミニマリスト業務統合サービス「Worknity（フェーズ1）」における、フロントエンド（React SPA）およびAIエージェントと、バックエンド（Laravel API）間の通信仕様を定義する。

---

## 1. 共通仕様

### 1.1. ベースURL
* **一般API（フロントエンド用）：** `https://api.worknity.jp/api/v1`
* **MCP API（AIエージェント用）：** `https://api.worknity.jp/mcp/v1`

### 1.2. 共通リクエストヘッダ
すべてのAPI（ログインAPIを除く）は、認証および認可のために以下のヘッダを必須とする。

| ヘッダ名 | 設定値 | 説明 |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | リクエストボディのフォーマット |
| `Accept` | `application/json` | レスポンスボディのフォーマット（LaravelのバリデーションエラーをJSONで返却させるため必須） |
| `Authorization` | `Bearer <JWT_TOKEN>` | ログイン時に取得したJWTアクセストークン |

### 1.3. 共通エラーレスポンスフォーマット
エラー発生時、バックエンドは適切なHTTPステータスコードとともに、以下の構造のJSONを返却する。

#### バリデーションエラー（HTTP 422 Unprocessable Entity）
```json
{
  "message": "入力内容に不備があります。",
  "errors": {
    "email": [
      "メールアドレスの形式が正しくありません。"
    ],
    "password": [
      "パスワードは8文字以上で入力してください。"
    ]
  }
}
```

#### 認証・認可エラー（HTTP 401 Unauthorized / HTTP 403 Forbidden）
```json
{
  "message": "この操作を行う権限がありません。"
}
```

#### リソース未存在エラー（HTTP 404 Not Found）
※データガード要件に基づき、他テナントのIDを指定された場合もこのエラーを返却し、データの存在自体を秘匿する。
```json
{
  "message": "指定されたリソースが見つかりません。"
}
```

---

## 2. 認証・ユーザー関連API

### 2.1. ログイン
* **エンドポイント：** `POST /auth/login`
* **認証：** 不要
* **説明：** メールアドレスまたはユーザーIDと、パスワードで認証し、JWTを発行する。

#### リクエストボディ
```json
{
  "login_id": "admin@example.com", // メールアドレスまたはユーザーIDを入力
  "password": "secure_password"
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "login_id": "admin_user",
    "role": "admin",
    "organization_id": 101,
    "organization_name": "ワークニティ流通",
    "setup_completed": true,
    "organizations": [
      {
        "id": 101,
        "name": "ワークニティ流通"
      }
    ]
  }
}
```

---

### 2.2. 新規登録（メールアドレス・パスワード）
* **エンドポイント：** `POST /auth/register`
* **認証：** 不要
* **説明：** メールアドレス（またはユーザーID）とパスワードで新しいテナント（組織管理者）アカウントを作成する。

#### リクエストボディ
```json
{
  "email": "admin@example.com", // 任意（email または login_id のどちらかが必須）
  "login_id": "admin_user",     // 任意（email または login_id のどちらかが必須）
  "password": "secure_password"
}
```

#### レスポンス（HTTP 201 Created）
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "login_id": "admin_user",
    "role": "admin",
    "organization_id": 101,
    "organization_name": "", // 新規登録直後は空文字。ホーム画面のモーダルで登録する。
    "setup_completed": false,
    "organizations": [
      {
        "id": 101,
        "name": ""
      }
    ]
  },
  "is_new_user": true
}
```

---

### 2.3. ログアウト
* **エンドポイント：** `POST /auth/logout`
* **認証：** 必要
* **説明：** 現在のJWTトークンを無効化する。

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "ログアウトしました。"
}
```

---

### 2.4. トークンリフレッシュ
* **エンドポイント：** `POST /auth/refresh`
* **認証：** 不要（ヘッダの JWT 送信は不要。Cookie を使用）
* **説明：** セキュアCookie（`HttpOnly`）に含まれるリフレッシュトークンを用いて、新しいJWTアクセストークンを再発行する（画面リロード時の自動ログインやサイレントリフレッシュ用）。

#### クッキー（送信）
* `refresh_token` (string, 必須): 暗号化されたリフレッシュトークン。リクエスト時にブラウザから自動送信されます。

#### レスポンス（HTTP 200 OK）
※レスポンスヘッダの `Set-Cookie` で新しい `refresh_token` が返却（Cookieのローテーション）されます。
```json
{
  "access_token": "new_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

### 2.5. ログインユーザー情報取得
* **エンドポイント：** `GET /auth/me`
* **認証：** 必要
* **説明：** 現在ログインしているユーザーの情報を取得する。

#### レスポンス（HTTP 200 OK）
```json
{
  "id": 1,
  "email": "admin@example.com",
  "role": "admin",
  "organization_id": 101,
  "organization_name": "ワークニティ流通",
  "setup_completed": true
}
```

---

### 2.6. ソーシャルログイン（リダイレクトURL取得）
* **エンドポイント：** `GET /auth/{provider}/redirect`
* **認証：** 不要
* **説明：** 指定したソーシャルプロバイダ（`google`, `line`, `microsoft`, `yahoo`）のOAuth認証画面へ遷移するためのURLを返却する。

#### パスパラメータ
* `provider` (string, 必須): プロバイダ名 (`google`, `line`, `microsoft`, `yahoo`)

#### レスポンス（HTTP 200 OK）
```json
{
  "redirect_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

---

### 2.7. ソーシャルログイン（コールバック処理）
* **エンドポイント：** `GET /auth/{provider}/callback`
* **認証：** 不要
* **説明：** 各プラットフォームでの認証完了後、フロントエンドが認可コードを受け取ってバックエンドへ送信し、認証（および新規登録）を完了させてJWTを発行する。

#### パスパラメータ
* `provider` (string, 必須): プロバイダ名 (`google`, `line`, `microsoft`, `yahoo`)

#### クエリパラメータ
* `code` (string, 必須): プロバイダから発行された認可コード
* `state` (string, 任意): クロスサイトリクエストフォージェリ（CSRF）防止用トークン

#### レスポンス（HTTP 200 OK）
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 2,
    "email": "social_user@example.com",
    "role": "admin",
    "organization_id": 102,
    "organization_name": "", // 新規ユーザー登録時は空文字。既存ユーザーは既存の組織名
    "setup_completed": false // 新規登録の場合は false、既存のログインの場合は true
  },
  "is_new_user": true // 新規登録の場合は true、既存のログインの場合は false
}
```

---

### 2.8. 新規テナント初期セットアップ（組織名登録）
* **エンドポイント：** `PUT /auth/organization/setup`
* **認証：** 必要（`role = admin` かつ `setup_completed = false` 時のみ）
* **説明：** 新規作成されたテナント（組織）に対して、最初の組織名（グループ・チーム名や屋号）を設定する。

#### リクエストボディ
* `organization_name` (string, 必須): 登録する組織名・グループ名・屋号 (1〜255文字)

```json
{
  "organization_name": "ワークニティ流通"
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "初期セットアップが完了しました。",
  "organization": {
    "id": 102,
    "name": "ワークニティ流通"
  }
}
```

---

### 2.9. パスキー（WebAuthn）登録オプション取得
* **エンドポイント：** `POST /auth/passkey/register/options`
* **認証：** 必要
* **説明：** ログイン中のユーザーが現在使用しているデバイスにパスキーを新規登録するための暗号パラメータ（チャレンジ値など）を生成する。

#### レスポンス（HTTP 200 OK）
```json
{
  "registration_options": {
    "challenge": "a8x9Jd...",
    "rp": { "name": "Worknity", "id": "worknity.jp" },
    "user": { "id": "dXNlcmlkMTIz", "name": "user@example.com", "displayName": "user@example.com" },
    "pubKeyCredParams": [ { "type": "public-key", "alg": -7 } ]
  }
}
```

---

### 2.10. パスキー（WebAuthn）登録実行
* **エンドポイント：** `POST /auth/passkey/register`
* **認証：** 必要
* **説明：** デバイスが生成した公開鍵データ（認証証明）をバックエンドに送信し、パスキー登録を完了する。

#### リクエストボディ
* デバイスから返却された WebAuthn 登録データ構造をそのまま送信

#### レスポンス（HTTP 201 Created）
```json
{
  "message": "パスキーを登録しました。"
}
```

---

### 2.11. パスキー（WebAuthn）ログインオプション取得
* **エンドポイント：** `POST /auth/passkey/login/options`
* **認証：** 不要
* **説明：** パスキーでログインを開始するためのパラメータを生成する。

#### リクエストボディ
* `email` (string, 必須): ログインしようとするユーザーのメールアドレス

```json
{
  "email": "user@example.com"
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "assertion_options": {
    "challenge": "e7Y8aD...",
    "rpId": "worknity.jp",
    "allowCredentials": [
      { "type": "public-key", "id": "cred_id_1..." }
    ]
  }
}
```

---

### 2.12. パスキー（WebAuthn）ログイン実行
* **エンドポイント：** `POST /auth/passkey/login`
* **認証：** 不要
* **説明：** デバイスで生体認証をパスした結果（署名データ）をバックエンドへ送信し、ログイン処理（JWT発行）を完了する。

#### リクエストボディ
* デバイスから返却された WebAuthn ログイン署名データ構造

#### レスポンス（HTTP 200 OK）
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "login_id": "user_id",
    "role": "admin",
    "organization_id": 101,
    "organization_name": "ワークニティ流通",
    "setup_completed": true,
    "organizations": [
      {
        "id": 101,
        "name": "ワークニティ流通"
      }
    ]
  }
}
```

---

### 2.13. 組織（グループ）切り替え
* **エンドポイント：** `POST /auth/organization/switch`
* **認証：** 必要
* **説明：** ログインしているユーザーが操作する組織（グループ）を切り替え、切り替え先組織の権限情報を含む新しいJWTを発行する。

#### リクエストボディ
* `organization_id` (integer, 必須): 切り替え先の組織ID

```json
{
  "organization_id": 102
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "access_token": "new_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "login_id": "user_id",
    "role": "staff", // 切り替え先組織におけるロール
    "organization_id": 102,
    "organization_name": "渋谷ボランティア支部",
    "setup_completed": true,
    "organizations": [
      { "id": 101, "name": "ワークニティ流通" },
      { "id": 102, "name": "渋谷ボランティア支部" }
    ]
  }
}
```

---

## 3. 在庫管理API（コア機能）

すべての在庫管理APIは、JWTに含まれる `organization_id` に基づき自動的にテナントデータが隔離（データガード）される。

### 3.1. 在庫一覧取得
* **エンドポイント：** `GET /stocks`
* **認証：** 必要
* **説明：** ログインユーザーの所属企業に紐づく在庫一覧を取得する。商品名での部分一致検索が可能。

#### クエリパラメータ
* `keyword` (string, 任意): 商品名の部分一致検索ワード
* `page` (integer, 任意): ページ番号（デフォルト: 1）
* `per_page` (integer, 任意): 1ページあたりの件数（デフォルト: 50）

#### レスポンス（HTTP 200 OK）
```json
{
  "data": [
    {
      "id": 10,
      "product_name": "ミネラルウォーター 500ml",
      "quantity": 120,
      "minimum_quantity": 50, // 安全在庫数（しきい値）
      "recent_quantities": [100, 100, 105, 120, 120, 115, 120], // 直近の数量推移（スパークライン用、最大7件）
      "jan_code": "4901234567890",
      "description": "南アルプスの天然水。すっきり飲みやすい軟水です。",
      "image_url": "https://example.com/water.jpg",
      "price": 100,
      "brand_name": "サントリー",
      "category_name": "水・ソフトドリンク ＞ 鉱水",
      "attributes": {
        "expiration_date": "2026-12-31",
        "storage_location": "A倉庫-棚3"
      },
      "created_at": "2026-06-02T03:00:00Z",
      "updated_at": "2026-06-02T04:30:00Z"
    },
    {
      "id": 11,
      "product_name": "オフィス用紙 A4",
      "quantity": 15,
      "minimum_quantity": 20,
      "recent_quantities": [20, 20, 18, 18, 15, 15, 15],
      "jan_code": null,
      "description": null,
      "image_url": null,
      "price": null,
      "brand_name": null,
      "category_name": null,
      "attributes": {},
      "created_at": "2026-06-02T03:05:00Z",
      "updated_at": "2026-06-02T03:05:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 50,
    "total": 115
  }
}
```

---

### 3.2. 新規商品登録
* **エンドポイント：** `POST /stocks`
* **認証：** 必要
* **説明：** 新しい商品を在庫マスタに登録する。初期数量は0または任意。

#### リクエストボディ
* `product_name` (string, 必須): 商品名 (1〜255文字)
* `quantity` (integer, 任意): 初期数量 (0以上の整数。デフォルト: 0)
* `minimum_quantity` (integer, 任意): 安全在庫数 (0以上の整数。デフォルト: 0)
* `jan_code` (string, 任意): JANコード (バーコード)
* `description` (string, 任意): 商品説明・仕様
* `image_url` (string, 任意): 商品画像URL (最大2048文字)
* `price` (integer, 任意): 参考価格 (0以上の整数)
* `brand_name` (string, 任意): ブランド・メーカー名
* `category_name` (string, 任意): カテゴリ名
* `attributes` (object, 任意): 拡張属性JSONオブジェクト

```json
{
  "product_name": "アルコール消毒液",
  "quantity": 10,
  "minimum_quantity": 5,
  "jan_code": "4901234567891",
  "description": "手指消毒用アルコールスプレー。速乾性。",
  "image_url": "https://example.com/alcohol.jpg",
  "price": 600,
  "brand_name": "サラヤ",
  "category_name": "日用品 ＞ 衛生医療品 ＞ 消毒液",
  "attributes": {
    "temperature_zone": "room_temperature"
  }
}
```

#### レスポンス（HTTP 201 Created）
```json
{
  "id": 12,
  "product_name": "アルコール消毒液",
  "quantity": 10,
  "minimum_quantity": 5,
  "jan_code": "4901234567891",
  "description": "手指消毒用アルコールスプレー。速乾性。",
  "image_url": "https://example.com/alcohol.jpg",
  "price": 600,
  "brand_name": "サラヤ",
  "category_name": "日用品 ＞ 衛生医療品 ＞ 消毒液",
  "attributes": {
    "temperature_zone": "room_temperature"
  },
  "created_at": "2026-06-02T04:19:15Z",
  "updated_at": "2026-06-02T04:19:15Z"
}
```

---

### 3.3. 入庫処理
* **エンドポイント：** `POST /stocks/{id}/inflow`
* **認証：** 必要
* **説明：** 指定した商品の在庫数量を加算する（悲観的ロックによる排他制御対象）。

#### リクエストボディ
* `quantity` (integer, 必須): 加算する数量 (1以上の整数)

```json
{
  "quantity": 50
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "id": 10,
  "product_name": "ミネラルウォーター 500ml",
  "quantity": 170, // 120 + 50
  "minimum_quantity": 50,
  "attributes": {
    "expiration_date": "2026-12-31",
    "storage_location": "A倉庫-棚3"
  },
  "updated_at": "2026-06-02T04:35:00Z"
}
```

---

### 3.4. 出庫処理
* **エンドポイント：** `POST /stocks/{id}/outflow`
* **認証：** 必要
* **説明：** 指定した商品の在庫数量を減算する（悲観的ロックによる排他制御対象）。
* **エラーポリシー：** 減算後の在庫がマイナスになる場合は、HTTP 422エラーを返却して処理をブロックする。

#### リクエストボディ
* `quantity` (integer, 必須): 減算する数量 (1以上の整数)

```json
{
  "quantity": 20
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "id": 10,
  "product_name": "ミネラルウォーター 500ml",
  "quantity": 100, // 120 - 20
  "minimum_quantity": 50,
  "attributes": {
    "expiration_date": "2026-12-31",
    "storage_location": "A倉庫-棚3"
  },
  "updated_at": "2026-06-02T04:35:00Z"
}
```

---

### 3.5. 棚卸（数量上書き）処理
* **エンドポイント：** `PUT /stocks/{id}/stocktake`
* **認証：** 必要
* **説明：** 指定した商品の在庫数量を入力された数量で完全に上書きする（悲観的ロックによる排他制御対象）。

#### リクエストボディ
* `quantity` (integer, 必須): 上書きする数量 (0以上の整数)

```json
{
  "quantity": 95
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "id": 10,
  "product_name": "ミネラルウォーター 500ml",
  "quantity": 95, // 95 に上書き
  "minimum_quantity": 50,
  "attributes": {
    "expiration_date": "2026-12-31",
    "storage_location": "A倉庫-棚3"
  },
  "updated_at": "2026-06-02T04:35:00Z"
}
```

---

### 3.6. 在庫履歴取得
* **エンドポイント：** `GET /stocks/{id}/history`
* **認証：** 必要
* **説明：** 指定した商品の過去の在庫変動ログ（履歴）を最新順に取得する。

#### パスパラメータ
* `id` (integer, 必須): 商品ID

#### レスポンス（HTTP 200 OK）
```json
{
  "data": [
    {
      "id": 5,
      "operation": "in", // create, in, out, stocktake
      "prior_quantity": 100,
      "new_quantity": 150,
      "created_at": "2026-06-18T05:00:00Z",
      "operator_name": "admin_user" // 操作を実行した担当者名
    },
    {
      "id": 2,
      "operation": "out",
      "prior_quantity": 120,
      "new_quantity": 100,
      "created_at": "2026-06-12T03:30:00Z",
      "operator_name": "staff_tanaka"
    }
  ]
}
```

---

## 4. スタッフ管理API（管理者用）

本APIの実行には、ログイン中ユーザーのロールが `admin` であることが必須。`staff` ロールのユーザーが実行した場合、HTTP 403 Forbiddenを返却する。

### 4.1. スタッフ一覧取得
* **エンドポイント：** `GET /users`
* **認証：** 必要（`role = admin` のみ）
* **説明：** 自社に紐づくユーザー（スタッフおよび管理者自身）の一覧を取得する。

#### レスポンス（HTTP 200 OK）
```json
[
  {
    "id": 1,
    "email": "admin@example.com",
    "role": "admin",
    "created_at": "2026-06-01T12:00:00Z"
  },
  {
    "id": 2,
    "email": "staff_tanaka@example.com",
    "role": "staff",
    "created_at": "2026-06-02T01:00:00Z"
  }
]
```

---

### 4.2. スタッフ追加
* **エンドポイント：** `POST /users`
* **認証：** 必要（`role = admin` のみ）
* **説明：** 自社に所属する新規スタッフアカウントを追加する。

#### リクエストボディ
* `email` (string, 必須): メールアドレス（システム全体で一意）
* `password` (string, 必須): パスワード（8文字以上）

```json
{
  "email": "staff_sato@example.com",
  "password": "staff_secure_password"
}
```

#### レスポンス（HTTP 201 Created）
```json
{
  "id": 3,
  "email": "staff_sato@example.com",
  "role": "staff", // 自動的に 'staff' ロールが付与される
  "organization_id": 101, // 管理者の organization_id が自動で設定される
  "created_at": "2026-06-02T04:19:15Z"
}
```

---

## 5. AI/MCP (Model Context Protocol) 連携API

AIエージェント用の通信窓口。すべてのリクエストヘッダに `Authorization: Bearer <JWT_TOKEN>` を必須とする。

### 5.1. 提供ツールの定義リスト返却
* **エンドポイント：** `POST /mcp/v1/tools/list`
* **説明：** AIエージェントが実行可能な操作ツールの定義（JSON Schema）を返却する。

#### レスポンス（HTTP 200 OK）
```json
{
  "tools": [
    {
      "name": "get_stock_list",
      "description": "現在庫の一覧を取得します。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "keyword": { "type": "string", "description": "検索キーワード（商品名）" }
        }
      }
    },
    {
      "name": "adjust_stock",
      "description": "在庫の入庫、出庫、または棚卸を行います。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "product_name": { "type": "string", "description": "商品名（完全一致または新規登録）" },
          "operation": { "type": "string", "enum": ["in", "out", "overwrite"], "description": "操作種別 (in: 入庫, out: 出庫, overwrite: 棚卸)" },
          "quantity": { "type": "integer", "minimum": 0, "description": "操作する数量" }
        },
        "required": ["product_name", "operation", "quantity"]
      }
    }
  ]
}
```

---

### 5.2. AIからの命令実行（ツールの呼び出し）
* **エンドポイント：** `POST /mcp/v1/tools/call`
* **説明：** AIエージェントが要求したツールとパラメータを実行する。
* **安全性確保（Human-in-the-loop）：**
  バックエンドは本APIの直接呼び出しを許可するが、フロントエンド側で「実行承認」ダイアログを表示し、ユーザーが承認した際のみにリクエストが送信される設計（あるいはバックエンド側で一旦保留ステータスにする設計）を推奨。

#### リクエストボディ
```json
{
  "name": "adjust_stock",
  "arguments": {
    "product_name": "ミネラルウォーター 500ml",
    "operation": "in",
    "quantity": 10
  }
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "content": [
    {
      "type": "text",
      "text": "商品「ミネラルウォーター 500ml」の在庫を10個入庫しました。現在の在庫数は130個です。"
    }
  ]
}
```

---

### 5.3. AI向け安全なリソース開示
* **エンドポイント：** `POST /mcp/v1/resources/list`
* **説明：** AIエージェントが追加コンテキストとして参照可能なリソース（在庫状況などの要約テキスト）の一覧を提供する。

#### レスポンス（HTTP 200 OK）
```json
{
  "resources": [
    {
      "uri": "worknity://stocks/summary",
      "name": "在庫サマリー",
      "description": "現在の全在庫名と数量の簡易一覧リスト",
      "mimeType": "text/plain"
    }
  ]
}
```

---

## 6. 勤怠管理API

### 6.1. 月次勤怠一覧取得
* **エンドポイント：** `GET /attendances`
* **認証：** 必要
* **説明：** 指定した月の勤怠データを取得する。一般スタッフは自身のデータのみ、管理者は組織内の全スタッフのデータまたは特定スタッフ（`user_id` 指定時）のデータを取得できる。

#### クエリパラメータ
* `month` (string, 任意): 対象月 (フォーマット: `YYYY-MM`, デフォルトは当月)
* `user_id` (integer, 任意): 特定スタッフのID（管理者のみ有効）

#### レスポンス（HTTP 200 OK）
```json
{
  "data": [
    {
      "id": 1,
      "organization_id": 101,
      "user_id": 2,
      "work_date": "2026-06-19",
      "clock_in": "2026-06-19 09:00:00",
      "clock_out": "2026-06-19 18:00:00",
      "break_minutes": 60,
      "status": "completed",
      "work_minutes": 480,
      "formatted_work_time": "08:00",
      "formatted_clock_in": "09:00",
      "formatted_clock_out": "18:00",
      "user": {
        "id": 2,
        "login_id": "staff_tanaka"
      }
    }
  ],
  "month": "2026-06"
}
```

---

### 6.2. 出勤打刻
* **エンドポイント：** `POST /attendances/clock-in`
* **認証：** 必要
* **説明：** 現在時刻で出勤打刻を行う。すでに当日の出勤データが存在する場合は 400 エラーとなる。

#### レスポンス（HTTP 201 Created）
```json
{
  "message": "出勤打刻を完了しました。",
  "data": {
    "id": 1,
    "user_id": 2,
    "work_date": "2026-06-19",
    "clock_in": "2026-06-19 09:00:00",
    "break_minutes": 0,
    "status": "working"
  }
}
```

---

### 6.3. 退勤打刻
* **エンドポイント：** `POST /attendances/clock-out`
* **認証：** 必要
* **説明：** 現在時刻で退勤打刻を行う。出勤打刻（ステータスが `working`）のデータが存在しない場合は 400 エラーとなる。労働時間（出勤から現在時刻）に応じて自動的に休憩時間が差し引かれる（8時間超で60分、6時間超で45分、その他は0分）。

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "退勤打刻を完了しました。今日も一日お疲れ様でした！",
  "data": {
    "id": 1,
    "user_id": 2,
    "work_date": "2026-06-19",
    "clock_in": "2026-06-19 09:00:00",
    "clock_out": "2026-06-19 18:00:00",
    "break_minutes": 60,
    "status": "completed"
  }
}
```

---

### 6.4. 申請一覧取得
* **エンドポイント：** `GET /attendance-requests`
* **認証：** 必要
* **説明：** 打刻修正や休暇の申請一覧を取得する。一般スタッフは自身の申請のみ、管理者は組織内の全申請を取得できる。

#### クエリパラメータ
* `status` (string, 任意): ステータスフィルター (`pending`, `approved`, `rejected`) - 管理者のみ有効

#### レスポンス（HTTP 200 OK）
```json
{
  "data": [
    {
      "id": 1,
      "organization_id": 101,
      "user_id": 2,
      "type": "correction",
      "status": "pending",
      "target_date": "2026-06-18",
      "requested_clock_in": "2026-06-18 09:00:00",
      "requested_clock_out": "2026-06-18 18:00:00",
      "requested_break_minutes": 60,
      "leave_type": null,
      "reason": "出勤打刻を押し忘れました。",
      "approved_by": null,
      "approved_at": null,
      "user_login_id": "staff_tanaka",
      "approver_login_id": null
    }
  ]
}
```

---

### 6.5. 新規申請送信
* **エンドポイント：** `POST /attendance-requests`
* **認証：** 必要
* **説明：** 打刻修正（`correction`）または休暇（`leave`）の申請を送信する。

#### リクエストボディ (打刻修正時)
```json
{
  "type": "correction",
  "target_date": "2026-06-18",
  "requested_clock_in": "09:00", // 時刻のみ (H:i)
  "requested_clock_out": "18:00", // 時刻のみ (H:i)
  "requested_break_minutes": 60,
  "reason": "打刻押し忘れのため修正をお願いします。"
}
```

#### リクエストボディ (休暇申請時)
```json
{
  "type": "leave",
  "target_date": "2026-06-25",
  "leave_type": "paid", // paid (有給), unpaid (無給), special (特別)
  "reason": "私用のためお休みをいただきます。"
}
```

#### レスポンス（HTTP 201 Created）
```json
{
  "message": "申請を送信しました。管理者の承認をお待ちください。",
  "data": {
    "id": 2,
    "user_id": 2,
    "type": "correction",
    "status": "pending",
    "target_date": "2026-06-18",
    "requested_clock_in": "2026-06-18 09:00:00",
    "requested_clock_out": "2026-06-18 18:00:00",
    "requested_break_minutes": 60,
    "reason": "打刻押し忘れのため修正をお願いします。"
  }
}
```

---

### 6.6. 申請承認（管理者のみ）
* **エンドポイント：** `PUT /attendance-requests/{id}/approve`
* **認証：** 必要（`role = admin` のみ）
* **説明：** 送信された申請を承認し、対応する勤務データを自動的に更新または作成する。

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "申請を承認し、勤務状況に反映しました。",
  "data": {
    "id": 2,
    "status": "approved",
    "approved_by": 1,
    "approved_at": "2026-06-19 18:20:00"
  }
}
```

---

### 6.7. 申請却下（管理者のみ）
* **エンドポイント：** `PUT /attendance-requests/{id}/reject`
* **認証：** 必要（`role = admin` のみ）
* **説明：** 送信された申請を却下する。

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "申請を却下しました。",
  "data": {
    "id": 2,
    "status": "rejected",
    "approved_by": 1,
    "approved_at": "2026-06-19 18:20:00"
  }
}
```

---

## 7. プロジェクト管理API

### 7.1. プロジェクト一覧取得
* **エンドポイント：** `GET /projects`
* **認証：** 必要
* **説明：** 自組織に紐づくプロジェクトの一覧を取得する。

#### クエリパラメータ
* `status` (string, 任意): ステータスフィルター (`planned`, `active`, `completed`, `suspended`)

#### レスポンス（HTTP 200 OK）
```json
{
  "data": [
    {
      "id": 1,
      "organization_id": 101,
      "name": "現場Aビル新築工事",
      "description": "電気設備工事一式",
      "status": "active",
      "start_date": "2026-06-01",
      "end_date": "2026-08-31",
      "budget_hours": 200,
      "actual_hours_sum": 120.0,
      "total_tasks_count": 10,
      "completed_tasks_count": 6,
      "progress_rate": 60,
      "created_at": "2026-06-01 10:00:00",
      "updated_at": "2026-06-25 10:00:00"
    }
  ]
}
```

---

### 7.2. プロジェクト詳細取得
* **エンドポイント：** `GET /projects/{id}`
* **認証：** 必要
* **説明：** 指定したプロジェクトの個別詳細情報を取得する。
* **データガード：** 他テナントのIDを指定された場合は一律 `404 Not Found` を返却する。

#### レスポンス（HTTP 200 OK）
```json
{
  "data": {
    "id": 1,
    "organization_id": 101,
    "name": "現場Aビル新築工事",
    "description": "電気設備工事一式",
    "status": "active",
    "start_date": "2026-06-01",
    "end_date": "2026-08-31",
    "budget_hours": 200,
    "actual_hours_sum": 120.0,
    "total_tasks_count": 10,
    "completed_tasks_count": 6,
    "progress_rate": 60,
    "created_at": "2026-06-01 10:00:00",
    "updated_at": "2026-06-25 10:00:00"
  }
}
```

---

### 7.3. プロジェクト作成（管理者のみ）
* **エンドポイント：** `POST /projects`
* **認証：** 必要（`role = admin` のみ）
* **説明：** 自組織に新しいプロジェクトを登録する。

#### リクエストボディ
```json
{
  "name": "新規現場Cビル配管工事",
  "description": "地下配管およびバルブ設置",
  "start_date": "2026-07-01",
  "end_date": "2026-07-31",
  "budget_hours": 80
}
```

#### レスポンス（HTTP 201 Created）
```json
{
  "message": "プロジェクトを作成しました。",
  "data": {
    "id": 3,
    "organization_id": 101,
    "name": "新規現場Cビル配管工事",
    "description": "地下配管およびバルブ設置",
    "status": "planned",
    "start_date": "2026-07-01",
    "end_date": "2026-07-31",
    "budget_hours": 80,
    "created_at": "2026-06-25 10:30:00"
  }
}
```

---

### 7.4. プロジェクト更新（管理者のみ）
* **エンドポイント：** `PUT /projects/{id}`
* **認証：** 必要（`role = admin` のみ）
* **説明：** プロジェクト情報を変更する。
* **データガード：** 他テナントのIDを指定された場合は一律 `404 Not Found` を返却する。

#### リクエストボディ
```json
{
  "name": "現場Aビル新築工事（追加案件）",
  "status": "active",
  "budget_hours": 220
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "プロジェクト情報を更新しました。",
  "data": {
    "id": 1,
    "name": "現場Aビル新築工事（追加案件）",
    "status": "active",
    "budget_hours": 220
  }
}
```

---

### 7.5. プロジェクト削除（管理者のみ）
* **エンドポイント：** `DELETE /projects/{id}`
* **認証：** 必要（`role = admin` のみ）
* **説明：** プロジェクトを削除する。紐づいていたタスクは削除されず `project_id = null` となる。
* **データガード：** 他テナントのIDを指定された場合は一律 `404 Not Found` を返却する。

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "プロジェクトを削除しました。紐づくタスクの連携を解除しました。"
}
```

---

## 8. タスク管理API

### 8.1. タスク一覧取得
* **エンドポイント：** `GET /tasks`
* **認証：** 必要
* **説明：** 自組織のタスク一覧を取得する。繰り返しタスクは、カレンダー描画ロジックによって日付にマッピングされる。

#### クエリパラメータ
* `project_id` (integer, 任意): 特定のプロジェクトで絞り込み。`0` または空の場合は「プロジェクトなし」の単発タスクで絞り込み。
* `status` (string, 任意): ステータス絞り込み (`todo`, `doing`, `done`)

#### レスポンス（HTTP 200 OK）
```json
{
  "data": [
    {
      "id": 10,
      "organization_id": 101,
      "project_id": 1,
      "name": "配線引き込み工事",
      "description": "1階の結線作業",
      "assignee_id": 2,
      "status": "doing",
      "due_date": "2026-06-30",
      "planned_hours": 8.0,
      "actual_hours": 4.0,
      "repeat_rule": null,
      "created_at": "2026-06-20 10:00:00"
    },
    {
      "id": 11,
      "organization_id": 101,
      "project_id": null,
      "name": "店舗外周の清掃",
      "description": "開店前のルーティン清掃",
      "assignee_id": null,
      "status": "todo",
      "due_date": "2026-06-25",
      "planned_hours": 0.5,
      "actual_hours": 0.0,
      "repeat_rule": {
        "pattern": "daily",
        "details": null,
        "non_working_day_behavior": "skip"
      },
      "created_at": "2026-06-25 08:00:00"
    }
  ]
}
```

---

### 8.2. タスク詳細取得
* **エンドポイント：** `GET /tasks/{id}`
* **認証：** 必要
* **説明：** 指定したタスクの個別詳細情報を取得する。
* **データガード：** 他テナントのIDを指定された場合は一律 `404 Not Found` を返却する。

#### レスポンス（HTTP 200 OK）
```json
{
  "data": {
    "id": 10,
    "organization_id": 101,
    "project_id": 1,
    "name": "配線引き込み工事",
    "description": "1階の結線作業",
    "assignee_id": 2,
    "status": "doing",
    "due_date": "2026-06-30",
    "planned_hours": 8.0,
    "actual_hours": 4.0,
    "repeat_rule": null,
    "created_at": "2026-06-20 10:00:00"
  }
}
```

---

### 8.3. タスク作成
* **エンドポイント：** `POST /tasks`
* **認証：** 必要
* **説明：** 通常タスクまたは繰り返しタスクを登録する。

#### リクエストボディ
```json
{
  "project_id": null,
  "name": "朝の開店準備",
  "description": "鍵開け、エアコン起動、レジ金準備",
  "assignee_id": null,
  "status": "todo",
  "due_date": "2026-06-25",
  "planned_hours": 1.0,
  "repeat_rule": {
    "pattern": "daily",
    "details": {},
    "non_working_day_behavior": "skip"
  }
}
```

#### レスポンス（HTTP 201 Created）
```json
{
  "message": "タスクを作成しました。",
  "data": {
    "id": 12,
    "organization_id": 101,
    "project_id": null,
    "name": "朝の開店準備",
    "description": "鍵開け、エアコン起動、レジ金準備",
    "assignee_id": null,
    "status": "todo",
    "due_date": "2026-06-25",
    "planned_hours": 1.0,
    "repeat_rule": {
      "id": 5,
      "pattern": "daily",
      "details": {},
      "non_working_day_behavior": "skip"
    },
    "created_at": "2026-06-25 10:35:00"
  }
}
```

---

### 8.4. タスク更新
* **エンドポイント：** `PUT /tasks/{id}`
* **認証：** 必要
* **説明：** タスク情報を更新する（ステータスや実績工数の更新など）。
* **データガード：** 他テナントのIDを指定された場合は一律 `404 Not Found` を返却する。

#### リクエストボディ
```json
{
  "status": "done",
  "actual_hours": 4.5
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "タスクを更新しました。",
  "data": {
    "id": 10,
    "status": "done",
    "actual_hours": 4.5
  }
}
```

---

### 8.5. タスク削除
* **エンドポイント：** `DELETE /tasks/{id}`
* **認証：** 必要
* **説明：** タスクを削除する。
* **データガード：** 他テナントのIDを指定された場合は一律 `404 Not Found` を返却する。

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "タスクを削除しました。"
}
```

---

### 8.6. コメント投稿
* **エンドポイント：** `POST /tasks/{id}/comments`
* **認証：** 必要
* **説明：** タスクにコメント（属性付き）を書き込む。
* **データガード：** 他テナントのタスクIDを指定された場合は一律 `404 Not Found` を返却する。

#### リクエストボディ
```json
{
  "content": "南側の配線完了時に、ダクト破損部分の養生も行いました。",
  "importance": "medium",
  "type": "log",
  "related_task_id": null
}
```

#### レスポンス（HTTP 201 Created）
```json
{
  "message": "コメントを投稿しました。",
  "data": {
    "id": 105,
    "organization_id": 101,
    "task_id": 10,
    "user_id": 2,
    "content": "南側の配線完了時に、ダクト破損部分の養生も行いました。",
    "importance": "medium",
    "type": "log",
    "related_task_id": null,
    "created_at": "2026-06-25 10:40:00"
  }
}
```

---

### 8.7. コメント一覧取得
* **エンドポイント：** `GET /tasks/{id}/comments`
* **認証：** 必要
* **説明：** 特定タスクのコメントを時系列順（古い順）に取得する。
* **データガード：** 他テナントのタスクIDを指定された場合は一律 `404 Not Found` を返却する。

#### レスポンス（HTTP 200 OK）
```json
{
  "data": [
    {
      "id": 104,
      "task_id": 10,
      "user": {
        "id": 2,
        "login_id": "staff_tanaka"
      },
      "content": "配線作業に入ります。",
      "importance": "low",
      "type": "communication",
      "related_task_id": null,
      "created_at": "2026-06-25 09:00:00"
    },
    {
      "id": 105,
      "task_id": 10,
      "user": {
        "id": 2,
        "login_id": "staff_tanaka"
      },
      "content": "南側の配線完了時に、ダクト破損部分の養生も行いました。",
      "importance": "medium",
      "type": "log",
      "related_task_id": null,
      "created_at": "2026-06-25 10:40:00"
    }
  ]
}
```

---

### 8.8. コメント一括クリーンアップ（管理者のみ）
* **エンドポイント：** `DELETE /comments/cleanup`
* **認証：** 必要（`role = admin` のみ）
* **説明：** 条件に合致する自組織内の古いコメントを一括で物理削除する。
* **セキュリティ：** クエリ内部で必ず `organization_id = ログインユーザーの組織ID` を強制し、他組織のデータが絶対に削除されないようにガードする。

#### リクエストボディ
```json
{
  "before_days": 30, // 30日以上前のコメント
  "types": ["memo", "log"], // メモとログが対象
  "importances": ["low", "medium"] // 低と中が対象
}
```

#### レスポンス（HTTP 200 OK）
```json
{
  "message": "条件に合致するコメント 142 件を一括削除しました。"
}
```

```

