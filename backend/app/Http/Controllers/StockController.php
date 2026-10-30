<?php

namespace App\Http\Controllers;

use App\Models\Stock;
use App\Models\StockLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class StockController extends Controller
{
    /**
     * Get list of stocks scoped to active organization.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Stock::query();

        $query->select('stocks.*')->selectSub(function ($q) {
            $q->from('purchase_order_items')
              ->join('purchase_orders', 'purchase_order_items.order_id', '=', 'purchase_orders.id')
              ->whereColumn('purchase_order_items.stock_id', 'stocks.id')
              ->whereIn('purchase_orders.status', ['ordered', 'partially_received'])
              ->selectRaw('COALESCE(SUM(purchase_order_items.quantity - purchase_order_items.received_quantity), 0)');
        }, 'on_order_quantity');

        // Optional keyword search (partial match on product name or exact match on jan code)
        if ($request->filled('keyword')) {
            $keyword = $request->keyword;
            $query->where(function ($q) use ($keyword) {
                $q->where('stocks.product_name', 'like', '%' . $keyword . '%')
                  ->orWhere('stocks.jan_code', $keyword);
            });
        }

        $perPage = $request->integer('per_page', 50);
        $stocks = $query->paginate($perPage);

        // Map pagination to match API interface specification
        return response()->json([
            'data' => $stocks->items(),
            'meta' => [
                'current_page' => $stocks->currentPage(),
                'last_page' => $stocks->lastPage(),
                'per_page' => $stocks->perPage(),
                'total' => $stocks->total()
            ]
        ]);
    }

    /**
     * Create a new stock item.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'product_name' => 'required|string|max:255',
            'quantity' => 'nullable|integer|min:0',
            'minimum_quantity' => 'nullable|integer|min:0',
            'attributes' => 'nullable|array',
            'jan_code' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:2048',
            'price' => 'nullable|integer|min:0',
            'brand_name' => 'nullable|string|max:255',
            'category_name' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $stock = DB::transaction(function () use ($request) {
                $qty = $request->input('quantity', 0);
                $minQty = $request->input('minimum_quantity', 0);

                // 1. Create stock
                $stock = Stock::create([
                    'product_name' => $request->product_name,
                    'quantity' => $qty,
                    'minimum_quantity' => $minQty,
                    'attributes' => $request->input('attributes', []),
                    'jan_code' => $request->jan_code,
                    'description' => $request->description,
                    'image_url' => $request->image_url,
                    'price' => $request->price,
                    'brand_name' => $request->brand_name,
                    'category_name' => $request->category_name,
                ]);

                // 2. Log initial creation
                StockLog::create([
                    'stock_id' => $stock->id,
                    'user_id' => auth()->id(),
                    'operation' => 'create',
                    'prior_quantity' => 0,
                    'new_quantity' => $qty,
                ]);

                return $stock;
            });

            // Reload recent_quantities relationship/accessor
            $stock->refresh();

            return response()->json($stock, 201);

        } catch (\Exception $e) {
            return response()->json(['message' => '商品登録に失敗しました。'], 500);
        }
    }

    /**
     * Increase stock quantity (Inflow).
     */
    public function inflow(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $stock = DB::transaction(function () use ($request, $id) {
                // Find stock with pessimistic lock. Scoped automatically by Multitenant trait.
                $stock = Stock::lockForUpdate()->find($id);

                // 404 Hide existence if not found or belongs to another tenant
                if (!$stock) {
                    throw new \Illuminate\Database\Eloquent\ModelNotFoundException();
                }

                $prior = $stock->quantity;
                $newQty = $prior + $request->quantity;

                // Update quantity
                $stock->quantity = $newQty;
                $stock->save();

                // Log operation
                StockLog::create([
                    'stock_id' => $stock->id,
                    'user_id' => auth()->id(),
                    'operation' => 'in',
                    'prior_quantity' => $prior,
                    'new_quantity' => $newQty,
                ]);

                return $stock;
            });

            $stock->refresh();
            return response()->json($stock);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        } catch (\Exception $e) {
            return response()->json(['message' => '入庫処理に失敗しました。'], 500);
        }
    }

    /**
     * Decrease stock quantity (Outflow).
     */
    public function outflow(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $stock = DB::transaction(function () use ($request, $id) {
                // Find stock with pessimistic lock
                $stock = Stock::lockForUpdate()->find($id);

                if (!$stock) {
                    throw new \Illuminate\Database\Eloquent\ModelNotFoundException();
                }

                $prior = $stock->quantity;
                $newQty = $prior - $request->quantity;

                // Validate stock doesn't go below 0
                if ($newQty < 0) {
                    throw ValidationException::withMessages([
                        'quantity' => ['出庫数が現在の在庫数を超えています。']
                    ]);
                }

                // Update quantity
                $stock->quantity = $newQty;
                $stock->save();

                // Log operation
                StockLog::create([
                    'stock_id' => $stock->id,
                    'user_id' => auth()->id(),
                    'operation' => 'out',
                    'prior_quantity' => $prior,
                    'new_quantity' => $newQty,
                ]);

                return $stock;
            });

            $stock->refresh();
            return response()->json($stock);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json(['message' => '出庫処理に失敗しました。'], 500);
        }
    }

    /**
     * Overwrite stock quantity (Stocktake).
     */
    public function stocktake(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $stock = DB::transaction(function () use ($request, $id) {
                // Find stock with pessimistic lock
                $stock = Stock::lockForUpdate()->find($id);

                if (!$stock) {
                    throw new \Illuminate\Database\Eloquent\ModelNotFoundException();
                }

                $prior = $stock->quantity;
                $newQty = $request->quantity;

                // Update quantity
                $stock->quantity = $newQty;
                $stock->save();

                // Log operation
                StockLog::create([
                    'stock_id' => $stock->id,
                    'user_id' => auth()->id(),
                    'operation' => 'stocktake',
                    'prior_quantity' => $prior,
                    'new_quantity' => $newQty,
                ]);

                return $stock;
            });

            $stock->refresh();
            return response()->json($stock);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        } catch (\Exception $e) {
            return response()->json(['message' => '棚卸処理に失敗しました。'], 500);
        }
    }

    /**
     * Get change logs for a specific stock (History).
     */
    public function history(Request $request, $id): JsonResponse
    {
        try {
            $stock = Stock::find($id);

            if (!$stock) {
                return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
            }

            // Get chronological logs, with user information for operator name
            $logs = DB::table('stock_logs')
                ->leftJoin('users', 'stock_logs.user_id', '=', 'users.id')
                ->where('stock_logs.stock_id', $stock->id)
                ->select([
                    'stock_logs.id',
                    'stock_logs.operation',
                    'stock_logs.prior_quantity',
                    'stock_logs.new_quantity',
                    'stock_logs.created_at',
                    'users.login_id as operator_name'
                ])
                ->orderBy('stock_logs.created_at', 'desc')
                ->orderBy('stock_logs.id', 'desc')
                ->get();

            return response()->json([
                'data' => $logs
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => '履歴データの取得に失敗しました。'], 500);
        }
    }

    /**
     * Update the specified stock item (Admin only).
     */
    public function update(Request $request, $id): JsonResponse
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

        $stock = Stock::find($id);
        if (!$stock) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        $validator = Validator::make($request->all(), [
            'product_name' => 'required|string|max:255',
            'minimum_quantity' => 'nullable|integer|min:0',
            'jan_code' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:2048',
            'price' => 'nullable|integer|min:0',
            'brand_name' => 'nullable|string|max:255',
            'category_name' => 'nullable|string|max:255',
            'attributes' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $stock->update([
            'product_name' => $request->product_name,
            'minimum_quantity' => $request->input('minimum_quantity', 0),
            'jan_code' => $request->jan_code,
            'description' => $request->description,
            'image_url' => $request->image_url,
            'price' => $request->price,
            'brand_name' => $request->brand_name,
            'category_name' => $request->category_name,
            'attributes' => $request->input('attributes', []),
        ]);

        return response()->json($stock);
    }

    /**
     * Remove the specified stock item (Admin only).
     */
    public function destroy($id): JsonResponse
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

        $stock = Stock::find($id);
        if (!$stock) {
            return response()->json(['message' => '指定されたリソースが見つかりません。'], 404);
        }

        $stock->delete();

        return response()->json(['message' => '商品を削除しました。']);
    }
}
