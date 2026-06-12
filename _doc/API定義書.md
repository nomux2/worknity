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
* `attributes` (object, 任意): 拡張属性JSONオブジェクト

```json
{
  "product_name": "アルコール消毒液",
  "quantity": 10,
  "minimum_quantity": 5,
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
