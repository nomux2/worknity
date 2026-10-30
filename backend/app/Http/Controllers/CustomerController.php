<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerField;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CustomerController extends Controller
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
     * Display a listing of customers.
     */
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->checkAuth()) {
            return $authError;
        }

        $query = Customer::query();

        // 1. Basic fields filters
        if ($request->filled('keyword')) {
            $keyword = $request->keyword;
            $query->where(function($q) use ($keyword) {
                $q->where('name', 'like', '%' . $keyword . '%')
                  ->orWhere('kana', 'like', '%' . $keyword . '%');
            });
        }

        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        if ($request->filled('kana')) {
            $query->where('kana', 'like', $request->kana . '%');
        }

        if ($request->filled('phone')) {
            $query->where('phone', 'like', '%' . $request->phone . '%');
        }

        if ($request->filled('email')) {
            $query->where('email', 'like', '%' . $request->email . '%');
        }

        if ($request->filled('address')) {
            $query->where('address', 'like', '%' . $request->address . '%');
        }

        if ($request->filled('postal_code')) {
            $query->where('postal_code', $request->postal_code);
        }

        // 2. Custom fields dynamic filters
        $searchableCustomFields = CustomerField::where('is_custom', true)
            ->where('is_searchable', true)
            ->get();

        foreach ($searchableCustomFields as $field) {
            if ($request->filled($field->field_key)) {
                $val = $request->input($field->field_key);
                if ($field->field_type === 'text') {
                    $query->where('attributes->' . $field->field_key, 'like', '%' . $val . '%');
                } else {
                    $query->where('attributes->' . $field->field_key, $val);
                }
            }
        }

        $customers = $query->orderBy('kana', 'asc')->get();

        return response()->json($customers);
    }

    /**
     * Store a newly created customer.
     */
    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->checkAuth()) {
            return $authError;
        }

        // Dynamic validation rules setup
        $rules = [
            'name' => 'required|string|max:255',
            'kana' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'postal_code' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
        ];

        $enabledCustomFields = CustomerField::where('is_custom', true)
            ->where('is_enabled', true)
            ->get();

        foreach ($enabledCustomFields as $field) {
            if ($field->field_type === 'number') {
                $rules[$field->field_key] = 'nullable|numeric';
            } elseif ($field->field_type === 'date') {
                $rules[$field->field_key] = 'nullable|date_format:Y-m-d';
            } else {
                $rules[$field->field_key] = 'nullable|string|max:1000';
            }
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        // Gather custom fields attributes
        $attributes = [];
        foreach ($enabledCustomFields as $field) {
            if ($request->has($field->field_key)) {
                $attributes[$field->field_key] = $request->input($field->field_key);
            }
        }

        $organizationId = auth()->payload()->get('organization_id');

        $customer = Customer::create([
            'organization_id' => $organizationId,
            'name' => $request->name,
            'kana' => $request->kana,
            'email' => $request->email,
            'phone' => $request->phone,
            'postal_code' => $request->postal_code,
            'address' => $request->address,
            'attributes' => $attributes,
        ]);

        return response()->json($customer, 201);
    }

    /**
     * Display the specified customer.
     */
    public function show($id): JsonResponse
    {
        if ($authError = $this->checkAuth()) {
            return $authError;
        }

        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        return response()->json($customer);
    }

    /**
     * Update the specified customer.
     */
    public function update(Request $request, $id): JsonResponse
    {
        if ($authError = $this->checkAuth()) {
            return $authError;
        }

        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        // Dynamic validation rules setup
        $rules = [
            'name' => 'required|string|max:255',
            'kana' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'postal_code' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
        ];

        $enabledCustomFields = CustomerField::where('is_custom', true)
            ->where('is_enabled', true)
            ->get();

        foreach ($enabledCustomFields as $field) {
            if ($field->field_type === 'number') {
                $rules[$field->field_key] = 'nullable|numeric';
            } elseif ($field->field_type === 'date') {
                $rules[$field->field_key] = 'nullable|date_format:Y-m-d';
            } else {
                $rules[$field->field_key] = 'nullable|string|max:1000';
            }
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        // Gather custom fields attributes
        $attributes = $customer->attributes ?? [];
        foreach ($enabledCustomFields as $field) {
            if ($request->has($field->field_key)) {
                $attributes[$field->field_key] = $request->input($field->field_key);
            }
        }

        $customer->update([
            'name' => $request->name,
            'kana' => $request->kana,
            'email' => $request->email,
            'phone' => $request->phone,
            'postal_code' => $request->postal_code,
            'address' => $request->address,
            'attributes' => $attributes,
        ]);

        return response()->json($customer);
    }

    /**
     * Remove the specified customer.
     */
    public function destroy($id): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        $customer->delete();

        return response()->json(['message' => '顧客を削除しました。']);
    }
}
