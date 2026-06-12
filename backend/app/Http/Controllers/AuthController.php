<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laragear\WebAuthn\Http\Requests\AttestationRequest;
use Laragear\WebAuthn\Http\Requests\AttestedRequest;
use Laragear\WebAuthn\Http\Requests\AssertionRequest;
use Laragear\WebAuthn\Http\Requests\AssertedRequest;

class AuthController extends Controller
{
    /**
     * Register a new group owner and organization.
     */
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|max:255|unique:users,email',
            'login_id' => 'nullable|alpha_num|max:255|unique:users,login_id',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = DB::transaction(function () use ($request) {
                // 1. Create Organization (temporary name)
                $organization = Organization::create([
                    'name' => '', // Set to empty, user will update via setup modal
                ]);

                // 2. Create User
                $user = User::create([
                    'email' => $request->email,
                    'login_id' => $request->login_id,
                    'password' => Hash::make($request->password),
                    'default_organization_id' => $organization->id,
                ]);

                // 3. Link organization and user with admin role
                $organization->users()->attach($user->id, ['role' => 'admin']);

                return $user;
            });

            $organizationId = $user->default_organization_id;
            $organizationName = '';

            // Generate tokens
            $accessToken = auth()->claims(['organization_id' => $organizationId])->setTTL(60)->fromUser($user);
            $refreshToken = auth()->claims(['is_refresh' => true, 'organization_id' => $organizationId])->setTTL(20160)->fromUser($user);

            $cookie = cookie('refresh_token', $refreshToken, 20160, '/', null, true, true, false, 'Lax');

            return response()->json([
                'access_token' => $accessToken,
                'token_type' => 'Bearer',
                'expires_in' => 3600,
                'user' => [
                    'id' => $user->id,
                    'email' => $user->email,
                    'login_id' => $user->login_id,
                    'role' => 'admin',
                    'organization_id' => $organizationId,
                    'organization_name' => $organizationName,
                    'setup_completed' => false,
                    'organizations' => [
                        [
                            'id' => $organizationId,
                            'name' => $organizationName
                        ]
                    ]
                ],
                'is_new_user' => true
            ], 201)->withCookie($cookie);

        } catch (\Exception $e) {
            return response()->json(['message' => '登録処理に失敗しました。' . $e->getMessage()], 500);
        }
    }

    /**
     * Authenticate user with email or login_id.
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'login_id' => 'required|string',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $loginInput = $request->login_id;
        $isEmail = filter_var($loginInput, FILTER_VALIDATE_EMAIL);

        // Find user by email or login_id
        $user = User::where($isEmail ? 'email' : 'login_id', $loginInput)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'ログインIDまたはパスワードが正しくありません。'
            ], 401);
        }

        // Get organizations user belongs to
        $organizations = $user->organizations;
        if ($organizations->isEmpty()) {
            return response()->json(['message' => '所属する組織が見つかりません。'], 403);
        }

        // Determine active organization
        $activeOrg = $organizations->firstWhere('id', $user->default_organization_id) ?: $organizations->first();
        $organizationId = $activeOrg->id;
        $organizationName = $activeOrg->name;
        $role = $activeOrg->pivot->role;
        $setupCompleted = !empty($organizationName);

        // Generate tokens
        $accessToken = auth()->claims(['organization_id' => $organizationId])->setTTL(60)->fromUser($user);
        $refreshToken = auth()->claims(['is_refresh' => true, 'organization_id' => $organizationId])->setTTL(20160)->fromUser($user);

        $cookie = cookie('refresh_token', $refreshToken, 20160, '/', null, true, true, false, 'Lax');

        $orgList = $organizations->map(function ($org) {
            return [
                'id' => $org->id,
                'name' => $org->name
            ];
        })->toArray();

        return response()->json([
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => 3600,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'login_id' => $user->login_id,
                'role' => $role,
                'organization_id' => $organizationId,
                'organization_name' => $organizationName,
                'setup_completed' => $setupCompleted,
                'organizations' => $orgList
            ]
        ])->withCookie($cookie);
    }

    /**
     * Refresh JWT token using HttpOnly refresh cookie.
     */
    public function refresh(Request $request): JsonResponse
    {
        $refreshToken = $request->cookie('refresh_token');

        if (!$refreshToken) {
            return response()->json(['message' => 'リフレッシュトークンが見つかりません。'], 401);
        }

        try {
            // Parse and validate refresh token
            $payload = auth()->setToken($refreshToken)->getPayload();
            if (!$payload->get('is_refresh')) {
                return response()->json(['message' => '不正なトークンです。'], 401);
            }

            $userId = $payload->get('sub');
            $organizationId = $payload->get('organization_id');

            $user = User::find($userId);
            if (!$user) {
                return response()->json(['message' => 'ユーザーが見つかりません。'], 401);
            }

            // Verify user belongs to organization
            $activeOrg = $user->organizations()->where('organization_id', $organizationId)->first();
            if (!$activeOrg) {
                return response()->json(['message' => '切り替え先組織に所属していません。'], 403);
            }

            // Rotate tokens
            $accessToken = auth()->claims(['organization_id' => $organizationId])->setTTL(60)->fromUser($user);
            $newRefreshToken = auth()->claims(['is_refresh' => true, 'organization_id' => $organizationId])->setTTL(20160)->fromUser($user);

            $cookie = cookie('refresh_token', $newRefreshToken, 20160, '/', null, true, true, false, 'Lax');

            return response()->json([
                'access_token' => $accessToken,
                'token_type' => 'Bearer',
                'expires_in' => 3600
            ])->withCookie($cookie);

        } catch (\Exception $e) {
            return response()->json(['message' => 'トークンの再発行に失敗しました。'], 401);
        }
    }

    /**
     * Get authenticated user details.
     */
    public function me(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }

        $organizationId = auth()->payload()->get('organization_id');
        $organizations = $user->organizations;
        $activeOrg = $organizations->firstWhere('id', $organizationId);

        if (!$activeOrg) {
            return response()->json(['message' => '所属組織のデータが見つかりません。'], 403);
        }

        $role = $activeOrg->pivot->role;
        $setupCompleted = !empty($activeOrg->name);

        $orgList = $organizations->map(function ($org) {
            return [
                'id' => $org->id,
                'name' => $org->name
            ];
        })->toArray();

        return response()->json([
            'id' => $user->id,
            'email' => $user->email,
            'login_id' => $user->login_id,
            'role' => $role,
            'organization_id' => $organizationId,
            'organization_name' => $activeOrg->name,
            'setup_completed' => $setupCompleted,
            'organizations' => $orgList
        ]);
    }

    /**
     * Setup organization name (initial setup).
     */
    public function setup(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'organization_name' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }

        $organizationId = auth()->payload()->get('organization_id');
        
        // Ensure user is admin of active organization
        $activeOrg = $user->organizations()
            ->where('organization_id', $organizationId)
            ->where('role', 'admin')
            ->first();

        if (!$activeOrg) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }

        // Update organization name
        $organization = Organization::find($organizationId);
        $organization->name = $request->organization_name;
        $organization->save();

        return response()->json([
            'message' => '初期セットアップが完了しました。',
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name
            ]
        ]);
    }

    /**
     * Switch active organization.
     */
    public function switchOrganization(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'organization_id' => 'required|integer|exists:organizations,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }

        $targetOrgId = $request->organization_id;

        // Verify membership
        $activeOrg = $user->organizations()->where('organization_id', $targetOrgId)->first();
        if (!$activeOrg) {
            return response()->json(['message' => '指定された組織に所属していません。'], 403);
        }

        // Update default organization in database so next login defaults to this
        $user->default_organization_id = $targetOrgId;
        $user->save();

        // Issue new tokens scoped to target organization
        $accessToken = auth()->claims(['organization_id' => $targetOrgId])->setTTL(60)->fromUser($user);
        $refreshToken = auth()->claims(['is_refresh' => true, 'organization_id' => $targetOrgId])->setTTL(20160)->fromUser($user);

        $cookie = cookie('refresh_token', $refreshToken, 20160, '/', null, true, true, false, 'Lax');

        $orgList = $user->organizations->map(function ($org) {
            return [
                'id' => $org->id,
                'name' => $org->name
            ];
        })->toArray();

        return response()->json([
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => 3600,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'login_id' => $user->login_id,
                'role' => $activeOrg->pivot->role,
                'organization_id' => $targetOrgId,
                'organization_name' => $activeOrg->name,
                'setup_completed' => !empty($activeOrg->name),
                'organizations' => $orgList
            ]
        ])->withCookie($cookie);
    }

    /**
     * Log out user (invalidate token and clear refresh cookie).
     */
    public function logout(): JsonResponse
    {
        try {
            auth()->logout();
        } catch (\Exception $e) {
            // Ignore token expiration issues during logout
        }

        // Clear HttpOnly cookie
        $cookie = cookie()->forget('refresh_token');

        return response()->json([
            'message' => 'ログアウトしました。'
        ])->withCookie($cookie);
    }

    /**
     * Get options to register a new passkey (WebAuthn).
     */
    public function passkeyRegisterOptions(AttestationRequest $request)
    {
        return $request->toCreate();
    }

    /**
     * Register a new passkey (WebAuthn).
     */
    public function passkeyRegister(AttestedRequest $request): JsonResponse
    {
        $credential = $request->save();
        
        $alias = request('name') ?: request('alias') ?: 'パスキー (' . now()->format('Y-m-d H:i') . ')';
        $credential->update([
            'alias' => $alias
        ]);

        return response()->json([
            'message' => 'パスキーの登録が完了しました。'
        ]);
    }

    /**
     * Get options to login with a passkey (WebAuthn).
     */
    public function passkeyLoginOptions(AssertionRequest $request)
    {
        $loginId = request('login_id') ?: request('email');
        if ($loginId) {
            $isEmail = filter_var($loginId, FILTER_VALIDATE_EMAIL);
            $user = User::where($isEmail ? 'email' : 'login_id', $loginId)->first();
            if ($user) {
                return $request->toVerify($user);
            }
        }

        return $request->toVerify();
    }

    /**
     * Login using a passkey (WebAuthn).
     */
    public function passkeyLogin(AssertedRequest $request): JsonResponse
    {
        $user = $request->login();

        if (!$user) {
            return response()->json([
                'message' => 'ログインに失敗しました。パスキーが無効です。'
            ], 401);
        }

        // Get organizations user belongs to
        $organizations = $user->organizations;
        if ($organizations->isEmpty()) {
            return response()->json(['message' => '所属する組織が見つかりません。'], 403);
        }

        // Determine active organization
        $activeOrg = $organizations->firstWhere('id', $user->default_organization_id) ?: $organizations->first();
        $organizationId = $activeOrg->id;
        $organizationName = $activeOrg->name;
        $role = $activeOrg->pivot->role;
        $setupCompleted = !empty($organizationName);

        // Generate tokens
        $accessToken = auth()->claims(['organization_id' => $organizationId])->setTTL(60)->fromUser($user);
        $refreshToken = auth()->claims(['is_refresh' => true, 'organization_id' => $organizationId])->setTTL(20160)->fromUser($user);

        $cookie = cookie('refresh_token', $refreshToken, 20160, '/', null, true, true, false, 'Lax');

        $orgList = $organizations->map(function ($org) {
            return [
                'id' => $org->id,
                'name' => $org->name
            ];
        })->toArray();

        return response()->json([
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => 3600,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'login_id' => $user->login_id,
                'role' => $role,
                'organization_id' => $organizationId,
                'organization_name' => $organizationName,
                'setup_completed' => $setupCompleted,
                'organizations' => $orgList
            ]
        ])->withCookie($cookie);
    }

    /**
     * Redirect to social provider (Mock).
     */
    public function socialRedirect(string $provider): JsonResponse
    {
        $callbackUrl = url("/api/auth/social/{$provider}/callback");

        return response()->json([
            'redirect_url' => $callbackUrl,
            'is_mock' => true,
            'provider' => $provider,
            'message' => '【開発用モック】本番環境では ' . ucfirst($provider) . ' のログイン画面へ遷移します。'
        ]);
    }

    /**
     * Social provider callback (Mock).
     */
    public function socialCallback(string $provider)
    {
        $email = "mock_{$provider}_user@example.com";
        $loginId = "mock_{$provider}";

        try {
            $user = DB::transaction(function () use ($email, $loginId) {
                $user = User::where('email', $email)->first();
                if ($user) {
                    return $user;
                }

                $organization = Organization::create([
                    'name' => 'モック組織 (' . ucfirst($loginId) . ')',
                ]);

                $user = User::create([
                    'email' => $email,
                    'login_id' => $loginId,
                    'password' => Hash::make('password123'),
                    'default_organization_id' => $organization->id,
                ]);

                $organization->users()->attach($user->id, ['role' => 'admin']);

                return $user;
            });

            $organizationId = $user->default_organization_id;
            
            // Generate tokens
            $accessToken = auth()->claims(['organization_id' => $organizationId])->setTTL(60)->fromUser($user);
            $refreshToken = auth()->claims(['is_refresh' => true, 'organization_id' => $organizationId])->setTTL(20160)->fromUser($user);

            $cookie = cookie('refresh_token', $refreshToken, 20160, '/', null, true, true, false, 'Lax');

            $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
            
            return redirect()->away("{$frontendUrl}/social-callback?token={$accessToken}")
                ->withCookie($cookie);

        } catch (\Exception $e) {
            return response()->json(['message' => 'ソーシャルログイン処理に失敗しました。' . $e->getMessage()], 500);
        }
    }
}
