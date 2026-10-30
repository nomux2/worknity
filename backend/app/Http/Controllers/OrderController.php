<?php

namespace App\Http\Controllers;

use App\Http\Requests\CatalogOrderRequest;
use App\Models\Catalog;
use App\Models\CatalogItem;
use App\Models\Device;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OrderController extends Controller
{
    /**
     * Place a new order (Kiosk device).
     */
    public function store(CatalogOrderRequest $request): JsonResponse
    {
        $organizationId = auth()->payload()->get('organization_id');
        $deviceId = auth()->payload()->get('device_id');

        // Fallback for debug/manual testing if device_id is not in JWT claims
        if (!$deviceId) {
            $deviceId = $request->header('X-Device-ID') ?: $request->input('device_id');
        }

        if (!$deviceId) {
            return response()->json(['message' => '端末情報が特定できません。'], 400);
        }

        // Verify device belongs to same organization
        $device = Device::find($deviceId);
        if (!$device) {
            return response()->json(['message' => 'Device not found.'], 404);
        }

        // Check if price should be calculated
        $catalogConfig = Catalog::where('organization_id', $organizationId)->first();
        $showPrice = $catalogConfig ? $catalogConfig->show_price : true;

        $order = DB::transaction(function () use ($request, $organizationId, $deviceId, $showPrice) {
            // Create order parent
            $order = Order::create([
                'organization_id' => $organizationId,
                'device_id' => $deviceId,
                'status' => 'ordered',
                'total_price' => null,
            ]);

            $totalPrice = 0;
            $itemsPayload = $request->input('items', []);

            foreach ($itemsPayload as $index => $itemData) {
                // Lock the item for read to ensure prices don't change during transaction
                $catalogItem = CatalogItem::where('id', $itemData['id'])
                    ->lockForUpdate()
                    ->first();

                if (!$catalogItem) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'items.' . $index . '.id' => ['指定された商品は存在しません。']
                    ]);
                }

                $price = $catalogItem->price;
                
                // If show_price is false, or database price is null, we treat price as null (or 0)
                $effectivePrice = ($showPrice && $price !== null) ? $price : null;

                OrderItem::create([
                    'order_id' => $order->id,
                    'item_id' => $catalogItem->id,
                    'quantity' => $itemData['quantity'],
                    'price' => $effectivePrice,
                ]);

                if ($effectivePrice !== null) {
                    $totalPrice += $effectivePrice * $itemData['quantity'];
                }
            }

            // Save calculated total price if applicable
            if ($showPrice && $totalPrice > 0) {
                $order->total_price = $totalPrice;
                $order->save();
            }

            return $order;
        });

        return response()->json([
            'message' => '注文を送信しました。',
            'data' => $order->load('items.item', 'device')
        ], 201);
    }

    /**
     * Get list of orders (Staff/Admin board).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['device', 'items.item']);

        // Default query scopes only uncompleted (ordered or preparing) unless history is explicitly requested
        if ($request->boolean('history', false)) {
            $query->orderBy('created_at', 'desc');
        } else {
            $query->whereIn('status', ['ordered', 'preparing'])
                  ->orderBy('created_at', 'asc'); // Oldest first (FIFO)
        }

        $orders = $query->get();

        return response()->json(['data' => $orders]);
    }

    /**
     * Update order対応status (Staff/Admin).
     */
    public function updateStatus(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:ordered,preparing,served',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Multi-tenant check via standard find
        $order = Order::find($id);
        if (!$order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        DB::transaction(function () use ($order, $request) {
            $order->status = $request->status;
            $order->save();
        });

        return response()->json([
            'message' => 'ステータスを更新しました。',
            'data' => $order->load('items.item', 'device')
        ]);
    }
}
