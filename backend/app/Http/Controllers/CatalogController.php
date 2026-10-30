<?php

namespace App\Http\Controllers;

use App\Http\Requests\CatalogConfigRequest;
use App\Http\Requests\CatalogUnlockRequest;
use App\Models\Catalog;
use App\Models\CatalogCategory;
use App\Models\CatalogItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CatalogController extends Controller
{
    /**
     * Get active catalog configurations for the current organization.
     */
    public function getConfig(Request $request): JsonResponse
    {
        $organizationId = auth()->payload()->get('organization_id');
        
        $config = Catalog::firstOrCreate(
            ['organization_id' => $organizationId],
            [
                'unlock_password' => Hash::make('0000'), // Default unlock password
                'show_price' => true,
                'device_label' => 'テーブル',
            ]
        );

        // Hide password hash from client
        return response()->json([
            'data' => [
                'id' => $config->id,
                'show_price' => $config->show_price,
                'device_label' => $config->device_label,
            ]
        ]);
    }

    /**
     * Update catalog configuration (Admin/Staff only).
     */
    public function updateConfig(CatalogConfigRequest $request): JsonResponse
    {
        $organizationId = auth()->payload()->get('organization_id');
        
        $config = Catalog::where('organization_id', $organizationId)->first();
        if (!$config) {
            $config = new Catalog();
            $config->organization_id = $organizationId;
        }

        $config->unlock_password = Hash::make($request->unlock_password);
        $config->show_price = $request->show_price;
        $config->device_label = $request->device_label;
        $config->save();

        return response()->json([
            'message' => '設定を更新しました。',
            'data' => [
                'id' => $config->id,
                'show_price' => $config->show_price,
                'device_label' => $config->device_label,
            ]
        ]);
    }

    /**
     * Verify unlock password to exit kiosk mode.
     */
    public function unlock(CatalogUnlockRequest $request): JsonResponse
    {
        $organizationId = auth()->payload()->get('organization_id');
        $config = Catalog::where('organization_id', $organizationId)->first();

        if (!$config || !Hash::check($request->unlock_password, $config->unlock_password)) {
            return response()->json(['message' => '解除パスワードが一致しません。'], 422);
        }

        return response()->json(['message' => 'ロックを解除しました。']);
    }

    /**
     * Get menu categories with items for catalog browser.
     */
    public function getCatalog(): JsonResponse
    {
        // Scoped by organization_id automatically via Multitenant trait
        $categories = CatalogCategory::with(['items' => function ($query) {
            $query->orderBy('sort_order');
        }])->orderBy('sort_order')->get();

        return response()->json(['data' => $categories]);
    }

    /**
     * Save category (create or update).
     */
    public function storeCategory(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id' => 'nullable|integer|exists:catalog_categories,id',
            'name' => 'required|string|max:255',
            'sort_order' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $organizationId = auth()->payload()->get('organization_id');
        
        // Multi-tenant check for edit
        if ($request->filled('id')) {
            $category = CatalogCategory::find($request->id);
            if (!$category) {
                return response()->json(['message' => 'Category not found.'], 404);
            }
        } else {
            $category = new CatalogCategory();
            $category->organization_id = $organizationId;
        }

        $category->name = $request->name;
        $category->sort_order = $request->sort_order;
        $category->save();

        return response()->json([
            'message' => 'カテゴリを保存しました。',
            'data' => $category
        ]);
    }

    /**
     * Delete a category.
     */
    public function destroyCategory($id): JsonResponse
    {
        $category = CatalogCategory::find($id);
        if (!$category) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        $category->delete();

        return response()->json(['message' => 'カテゴリを削除しました。']);
    }

    /**
     * Save menu item (create or update).
     */
    public function storeItem(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id' => 'nullable|integer|exists:catalog_items,id',
            'category_id' => 'required|integer|exists:catalog_categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|integer|min:0',
            'image_path' => 'nullable|string|max:2048',
            'sort_order' => 'required|integer',
            'attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $organizationId = auth()->payload()->get('organization_id');

        // Verify category belongs to same organization
        $category = CatalogCategory::find($request->category_id);
        if (!$category) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        if ($request->filled('id')) {
            $item = CatalogItem::find($request->id);
            if (!$item) {
                return response()->json(['message' => 'Item not found.'], 404);
            }
        } else {
            $item = new CatalogItem();
            $item->organization_id = $organizationId;
        }

        $item->category_id = $request->category_id;
        $item->name = $request->name;
        $item->description = $request->description;
        $item->price = $request->price;
        $item->image_path = $request->image_path;
        $item->sort_order = $request->sort_order;
        $item->attributes = $request->input('attributes', []);
        $item->save();

        return response()->json([
            'message' => 'アイテムを保存しました。',
            'data' => $item
        ]);
    }

    /**
     * Delete a menu item.
     */
    public function destroyItem($id): JsonResponse
    {
        $item = CatalogItem::find($id);
        if (!$item) {
            return response()->json(['message' => 'Item not found.'], 404);
        }

        $item->delete();

        return response()->json(['message' => 'アイテムを削除しました。']);
    }
}
