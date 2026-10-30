<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AddonController extends Controller
{
    /**
     * Get the active addons for the authenticated user's organization.
     */
    public function index(): JsonResponse
    {
        $organizationId = auth()->payload()->get('organization_id');
        $organization = Organization::findOrFail($organizationId);

        return response()->json([
            'addons' => $organization->addons ?? [],
        ]);
    }

    /**
     * Update the active addons list.
     */
    public function update(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'addons' => 'nullable|array',
            'addons.*' => 'string|in:purchase_order',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $organizationId = auth()->payload()->get('organization_id');
        $organization = Organization::findOrFail($organizationId);

        $addons = $request->input('addons', []);
        $organization->update([
            'addons' => $addons,
        ]);

        return response()->json([
            'message' => 'アドオン設定を更新しました。',
            'addons' => $organization->addons ?? [],
        ]);
    }
}
