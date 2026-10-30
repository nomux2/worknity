<?php

namespace App\Http\Controllers;

use App\Models\Partner;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Stock;
use App\Models\StockLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    /**
     * Get list of purchase ordersscoped to active organization.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PurchaseOrder::with(['partner', 'creator']);

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filter by partner
        if ($request->filled('partner_id')) {
            $query->where('partner_id', $request->partner_id);
        }

        // Filter by date range
        if ($request->filled('start_date')) {
            $query->where('order_date', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->where('order_date', '<=', $request->end_date);
        }

        // Filter by keyword (order number)
        if ($request->filled('keyword')) {
            $query->where('order_number', 'like', '%' . $request->keyword . '%');
        }

        $perPage = $request->integer('per_page', 50);
        $orders = $query->orderBy('order_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        return response()->json([
            'data' => $orders->items(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total()
            ]
        ]);
    }

    /**
     * Get a specific purchase order detail (404 on other tenants due to Multitenant global scope).
     */
    public function show(int $id): JsonResponse
    {
        $order = PurchaseOrder::with(['partner', 'creator', 'items.stock'])->find($id);
        if (!$order) {
            return response()->json(['message' => '発注書が見つかりません。'], 404);
        }
        return response()->json(['data' => $order]);
    }

    /**
     * Create a new purchase order draft.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'partner_id' => 'required|integer',
            'order_date' => 'required|date',
            'delivery_deadline' => 'nullable|date|after_or_equal:order_date',
            'report_id' => 'nullable|integer',
            'items' => 'required|array|min:1',
            'items.*.stock_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify partner belongs to this tenant
        $partner = Partner::find($request->partner_id);
        if (!$partner) {
            return response()->json([
                'message' => '指定された取引先が見つかりません。',
                'errors' => ['partner_id' => ['無効な取引先です。']]
            ], 422);
        }

        // Verify all stock items belong to this tenant
        $stockIds = collect($request->items)->pluck('stock_id')->unique();
        $stocksCount = Stock::whereIn('id', $stockIds)->count();
        if ($stocksCount !== $stockIds->count()) {
            return response()->json([
                'message' => '指定された商品の一部が見つかりません。',
                'errors' => ['items' => ['無効な商品が含まれています。']]
            ], 422);
        }

        try {
            $order = DB::transaction(function () use ($request) {
                $orgId = auth()->payload()->get('organization_id');
                
                // Generate order number PO-YYYYMMDD-XXX
                $dateStr = date('Ymd', strtotime($request->order_date));
                $prefix = "PO-{$dateStr}-";
                $count = PurchaseOrder::where('order_number', 'like', $prefix . '%')->count();
                $seq = str_pad($count + 1, 3, '0', STR_PAD_LEFT);
                $orderNumber = $prefix . $seq;

                // Create Order Header
                $order = PurchaseOrder::create([
                    'partner_id' => $request->partner_id,
                    'report_id' => $request->report_id,
                    'order_number' => $orderNumber,
                    'order_date' => $request->order_date,
                    'delivery_deadline' => $request->delivery_deadline,
                    'status' => 'draft',
                    'created_by' => auth()->id(),
                ]);

                // Create Order Items
                foreach ($request->items as $item) {
                    PurchaseOrderItem::create([
                        'order_id' => $order->id,
                        'stock_id' => $item['stock_id'],
                        'quantity' => $item['quantity'],
                        'received_quantity' => 0,
                        'unit_price' => $item['unit_price'],
                    ]);
                }

                return $order;
            });

            return response()->json([
                'message' => '発注書を下書き保存しました。',
                'data' => PurchaseOrder::with(['partner', 'creator', 'items.stock'])->find($order->id)
            ], 201);

        } catch (\Exception $e) {
            return response()->json(['message' => '登録処理に失敗しました。' . $e->getMessage()], 500);
        }
    }

    /**
     * Update an existing purchase order (draft only).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $order = PurchaseOrder::find($id);
        if (!$order) {
            return response()->json(['message' => '発注書が見つかりません。'], 404);
        }
        if ($order->status !== 'draft') {
            return response()->json(['message' => '下書き状態の発注のみ編集可能です。'], 422);
        }

        $validator = Validator::make($request->all(), [
            'partner_id' => 'required|integer',
            'order_date' => 'required|date',
            'delivery_deadline' => 'nullable|date|after_or_equal:order_date',
            'report_id' => 'nullable|integer',
            'items' => 'required|array|min:1',
            'items.*.stock_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $partner = Partner::find($request->partner_id);
        if (!$partner) {
            return response()->json([
                'message' => '指定された取引先が見つかりません。',
                'errors' => ['partner_id' => ['無効な取引先です。']]
            ], 422);
        }

        $stockIds = collect($request->items)->pluck('stock_id')->unique();
        $stocksCount = Stock::whereIn('id', $stockIds)->count();
        if ($stocksCount !== $stockIds->count()) {
            return response()->json([
                'message' => '指定された商品の一部が見つかりません。',
                'errors' => ['items' => ['無効な商品が含まれています。']]
            ], 422);
        }

        try {
            DB::transaction(function () use ($request, $order) {
                // Update header
                $order->update([
                    'partner_id' => $request->partner_id,
                    'report_id' => $request->report_id,
                    'order_date' => $request->order_date,
                    'delivery_deadline' => $request->delivery_deadline,
                ]);

                // Replace items
                $order->items()->delete();
                foreach ($request->items as $item) {
                    PurchaseOrderItem::create([
                        'order_id' => $order->id,
                        'stock_id' => $item['stock_id'],
                        'quantity' => $item['quantity'],
                        'received_quantity' => 0,
                        'unit_price' => $item['unit_price'],
                    ]);
                }
            });

            return response()->json([
                'message' => '発注内容を更新しました。',
                'data' => PurchaseOrder::with(['partner', 'creator', 'items.stock'])->find($order->id)
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => '更新処理に失敗しました。' . $e->getMessage()], 500);
        }
    }

    /**
     * Delete a purchase order (draft only).
     */
    public function destroy(int $id): JsonResponse
    {
        $order = PurchaseOrder::find($id);
        if (!$order) {
            return response()->json(['message' => '発注書が見つかりません。'], 404);
        }
        if ($order->status !== 'draft') {
            return response()->json(['message' => '下書き状態の発注のみ削除可能です。'], 422);
        }

        $order->delete(); // Cascading delete will handle items
        return response()->json(['message' => '発注データを削除しました。']);
    }

    /**
     * Update order status (transition from draft to ordered, or cancel).
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $order = PurchaseOrder::with(['partner', 'items.stock'])->find($id);
        if (!$order) {
            return response()->json(['message' => '発注書が見つかりません。'], 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:ordered,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '無効なステータスです。'], 422);
        }

        $newStatus = $request->status;

        if ($newStatus === 'ordered') {
            if ($order->status !== 'draft') {
                return response()->json(['message' => '下書き状態の発注のみ発注確定できます。'], 422);
            }

            // 組織の承認設定を確認
            $orgId = auth()->payload()->get('organization_id');
            $settings = \App\Models\OrderSetting::where('organization_id', $orgId)->first();

            // 発注総額の計算
            $totalAmount = 0;
            $itemsSummary = [];
            foreach ($order->items as $item) {
                $totalAmount += $item->quantity * $item->unit_price;
                $itemsSummary[] = "{$item->stock->product_name} x {$item->quantity}";
            }

            $requireApproval = false;
            if ($settings && $settings->require_approval) {
                if (is_null($settings->approval_threshold) || $totalAmount >= $settings->approval_threshold) {
                    $requireApproval = true;
                }
            }

            if ($requireApproval && $settings->report_template_id) {
                // 承認待ちステータスにし、裏で自動申請起票
                $order->update(['status' => 'pending_approval']);

                $workflowService = app(\App\Services\WorkflowService::class);
                $attributes = [
                    'title' => "発注承認依頼: {$order->order_number}",
                    'partner_name' => $order->partner->name,
                    'total_amount' => $totalAmount,
                    'items_summary' => implode(', ', $itemsSummary),
                ];

                $workflowService->createWorkflowRequest($order, $settings->report_template_id, $attributes);

                return response()->json([
                    'message' => '発注承認申請を作成しました。承認されると発注が確定します。',
                    'data' => PurchaseOrder::with(['partner', 'creator', 'items.stock'])->find($order->id)
                ]);
            }
        } elseif ($newStatus === 'cancelled') {
            if (in_array($order->status, ['completed', 'cancelled'])) {
                return response()->json(['message' => '完了またはキャンセル済みの発注はキャンセルできません。'], 422);
            }
        }

        $order->update(['status' => $newStatus]);

        return response()->json([
            'message' => '発注ステータスを更新しました。',
            'data' => PurchaseOrder::with(['partner', 'creator', 'items.stock'])->find($order->id)
        ]);
    }

    /**
     * Handle receipt (inflow) of goods, supporting partial receipts (分納).
     */
    public function receive(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:0', // quantity received now
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $updatedOrder = DB::transaction(function () use ($request, $id) {
                // 1. Lock Order Header for update
                $order = PurchaseOrder::where('id', $id)->lockForUpdate()->firstOrFail();

                if (!in_array($order->status, ['ordered', 'partially_received'])) {
                    throw ValidationException::withMessages([
                        'order' => ['発注済または一部入荷済みの伝票のみ入荷処理可能です。']
                    ]);
                }

                // 2. Process each receipt item
                foreach ($request->items as $receipt) {
                    $qtyReceivedNow = $receipt['quantity'];
                    if ($qtyReceivedNow <= 0) continue; // Skip items with no incoming quantity

                    // Lock Order Item
                    $orderItem = PurchaseOrderItem::where('id', $receipt['item_id'])
                        ->where('order_id', $order->id)
                        ->lockForUpdate()
                        ->first();

                    if (!$orderItem) {
                        throw ValidationException::withMessages([
                            'items' => ["指定された明細ID ({$receipt['item_id']}) が見つかりません。"]
                        ]);
                    }

                    // Check validation: received + now <= ordered
                    $newTotalReceived = $orderItem->received_quantity + $qtyReceivedNow;
                    if ($newTotalReceived > $orderItem->quantity) {
                        $remaining = $orderItem->quantity - $orderItem->received_quantity;
                        throw ValidationException::withMessages([
                            'items' => ["商品 [{$orderItem->stock->product_name}] の入荷数が発注残数 ({$remaining}) を超えています。"]
                        ]);
                    }

                    // Lock Stock
                    $stock = Stock::where('id', $orderItem->stock_id)
                        ->lockForUpdate()
                        ->firstOrFail();

                    $priorQty = $stock->quantity;
                    $newQty = $priorQty + $qtyReceivedNow;

                    // Update Stock quantity
                    $stock->update(['quantity' => $newQty]);

                    // Update Order Item received quantity
                    $orderItem->update(['received_quantity' => $newTotalReceived]);

                    // Write StockLog
                    StockLog::create([
                        'stock_id' => $stock->id,
                        'user_id' => auth()->id(),
                        'purchase_order_id' => $order->id,
                        'operation' => 'inflow',
                        'prior_quantity' => $priorQty,
                        'new_quantity' => $newQty,
                    ]);
                }

                // 3. Determine order status based on remaining quantities
                $allCompleted = true;
                $anyReceived = false;

                // Refresh items
                $items = PurchaseOrderItem::where('order_id', $order->id)->get();
                foreach ($items as $item) {
                    if ($item->received_quantity < $item->quantity) {
                        $allCompleted = false;
                    }
                    if ($item->received_quantity > 0) {
                        $anyReceived = true;
                    }
                }

                $newStatus = $order->status;
                if ($allCompleted) {
                    $newStatus = 'completed';
                } elseif ($anyReceived) {
                    $newStatus = 'partially_received';
                }

                $order->update(['status' => $newStatus]);

                return $order;
            });

            return response()->json([
                'message' => '入荷処理が完了しました。',
                'data' => PurchaseOrder::with(['partner', 'creator', 'items.stock'])->find($updatedOrder->id)
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => '発注データが見つかりません。'], 404);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => '入荷処理に失敗しました。',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json(['message' => '入荷処理に失敗しました。' . $e->getMessage()], 500);
        }
    }

    /**
     * Get order settings for the current organization.
     */
    public function getSettings(Request $request): JsonResponse
    {
        $orgId = auth()->payload()->get('organization_id');
        
        $settings = \App\Models\OrderSetting::firstOrCreate(
            ['organization_id' => $orgId],
            [
                'require_approval' => false,
                'approval_threshold' => null,
                'report_template_id' => null
            ]
        );

        return response()->json(['data' => $settings]);
    }

    /**
     * Update order settings for the current organization.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $orgId = auth()->payload()->get('organization_id');
        
        $validator = Validator::make($request->all(), [
            'require_approval' => 'required|boolean',
            'approval_threshold' => 'nullable|integer|min:0',
            'report_template_id' => 'nullable|exists:report_templates,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $settings = \App\Models\OrderSetting::updateOrCreate(
            ['organization_id' => $orgId],
            $request->only(['require_approval', 'approval_threshold', 'report_template_id'])
        );

        return response()->json(['data' => $settings]);
    }
}
