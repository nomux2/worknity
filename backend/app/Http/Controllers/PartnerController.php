<?php

namespace App\Http\Controllers;

use App\Models\Partner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PartnerController extends Controller
{
    /**
     * Check if active user is organization admin.
     */
    private function checkAdmin(): ?JsonResponse
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }

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
     * Display a listing of partners.
     */
    public function index(Request $request): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $query = Partner::query();
        if ($request->filled('keyword')) {
            $query->where('name', 'like', '%' . $request->keyword . '%');
        }

        $partners = $query->orderBy('name', 'asc')->get();

        return response()->json($partners);
    }

    /**
     * Store a newly created partner.
     */
    public function store(Request $request): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $partner = Partner::create([
            'name' => $request->name,
            'address' => $request->address,
            'phone' => $request->phone,
        ]);

        return response()->json($partner, 201);
    }

    /**
     * Display the specified partner.
     */
    public function show($id): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $partner = Partner::find($id);
        if (!$partner) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        return response()->json($partner);
    }

    /**
     * Update the specified partner.
     */
    public function update(Request $request, $id): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $partner = Partner::find($id);
        if (!$partner) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $partner->update([
            'name' => $request->name,
            'address' => $request->address,
            'phone' => $request->phone,
        ]);

        return response()->json($partner);
    }

    /**
     * Remove the specified partner.
     */
    public function destroy($id): JsonResponse
    {
        if ($authError = $this->checkAdmin()) {
            return $authError;
        }

        $partner = Partner::find($id);
        if (!$partner) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        $partner->delete();

        return response()->json(['message' => '取引先を削除しました。']);
    }
}
