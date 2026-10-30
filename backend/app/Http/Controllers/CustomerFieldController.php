<?php

namespace App\Http\Controllers;

use App\Models\CustomerField;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CustomerFieldController extends Controller
{
    /**
     * Check if user is logged in.
     */
    private function checkAuth(): ?JsonResponse
    {
        if (!auth()->user()) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }
        return null;
    }

    /**
     * Check if active user is organization admin.
     */
    private function checkAdmin(): ?JsonResponse
    {
        if ($error = $this->checkAuth()) {
            return $error;
        }

        $user = auth()->user();
        $organizationId = auth()->payload()->get('organization_id');
        $activeOrg = $user->organizations()
            ->where('organization_id', $organizationId)
            ->wherePivot('role', 'admin')
            ->first();

        if (!$activeOrg) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }

        return null;
    }

    /**
     * Display a listing of the customer fields.
     */
    public function index(): JsonResponse
    {
        if ($authError = $this->checkAuth()) {
            return $authError;
        }

        $organizationId = auth()->payload()->get('organization_id');

        // Dynamic seeding for standard fields if they don't exist yet for this tenant
        $standardCount = CustomerField::where('is_custom', false)->count();
        if ($standardCount === 0) {
            $defaults = [
                ['field_key' => 'phone', 'field_name' => '電話番号', 'field_type' => 'text', 'sort_order' => 1],
                ['field_key' => 'email', 'field_name' => 'メールアドレス', 'field_type' => 'text', 'sort_order' => 2],
                ['field_key' => 'postal_code', 'field_name' => '郵便番号', 'field_type' => 'text', 'sort_order' => 3],
                ['field_key' => 'address', 'field_name' => '住所', 'field_type' => 'text', 'sort_order' => 4],
            ];
            foreach ($defaults as $default) {
                CustomerField::create([
                    'organization_id' => $organizationId,
                    'field_key' => $default['field_key'],
                    'field_name' => $default['field_name'],
                    'field_type' => $default['field_type'],
                    'is_custom' => false,
                    'is_enabled' => true,
                    'is_searchable' => true,
                    'sort_order' => $default['sort_order'],
                ]);
            }
        }

        $fields = CustomerField::orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        return response()->json($fields);
    }

    /**
     * Store a newly created customer field.
     */
    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'field_key' => 'required|string|max:50|regex:/^[a-zA-Z0-9_]+$/',
            'field_name' => 'required|string|max:100',
            'field_type' => 'required|string|in:text,number,select,date',
            'options' => 'nullable|array',
            'is_custom' => 'boolean',
            'is_enabled' => 'boolean',
            'is_searchable' => 'boolean',
            'sort_order' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        // Programmatic uniqueness check inside current tenant
        $exists = CustomerField::where('field_key', $request->field_key)->exists();
        if ($exists) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => ['field_key' => ['このフィールドキーは既に登録されています。']]
            ], 422);
        }

        $organizationId = auth()->payload()->get('organization_id');

        $field = CustomerField::create([
            'organization_id' => $organizationId,
            'field_key' => $request->field_key,
            'field_name' => $request->field_name,
            'field_type' => $request->field_type,
            'options' => $request->options,
            'is_custom' => $request->is_custom ?? true,
            'is_enabled' => $request->is_enabled ?? true,
            'is_searchable' => $request->is_searchable ?? true,
            'sort_order' => $request->sort_order ?? 0,
        ]);

        return response()->json($field, 201);
    }

    /**
     * Update the specified customer field.
     */
    public function update(Request $request, $id): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $field = CustomerField::find($id);
        if (!$field) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        $validator = Validator::make($request->all(), [
            'field_name' => 'required|string|max:100',
            'field_type' => 'required|string|in:text,number,select,date',
            'options' => 'nullable|array',
            'is_enabled' => 'boolean',
            'is_searchable' => 'boolean',
            'sort_order' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $field->update([
            'field_name' => $request->field_name,
            'field_type' => $field->is_custom ? $request->field_type : $field->field_type,
            'options' => $request->options,
            'is_enabled' => $request->is_enabled ?? $field->is_enabled,
            'is_searchable' => $request->is_searchable ?? $field->is_searchable,
            'sort_order' => $request->sort_order ?? $field->sort_order,
        ]);

        return response()->json($field);
    }

    /**
     * Remove the specified customer field.
     */
    public function destroy($id): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $field = CustomerField::find($id);
        if (!$field) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        if (!$field->is_custom) {
            return response()->json(['message' => 'システム標準項目は削除できません。'], 400);
        }

        $field->delete();

        return response()->json(['message' => '項目を削除しました。']);
    }
}
