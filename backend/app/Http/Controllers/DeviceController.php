<?php

namespace App\Http\Controllers;

use App\Http\Requests\DeviceAuthRequest;
use App\Http\Requests\DeviceRegisterRequest;
use App\Models\Device;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DeviceController extends Controller
{
    /**
     * Register a new kiosk device (Admin/Staff only).
     */
    public function register(DeviceRegisterRequest $request): JsonResponse
    {
        $organizationId = auth()->payload()->get('organization_id');
        if (!$organizationId) {
            return response()->json(['message' => '組織IDが見つかりません。'], 403);
        }

        $accessToken = Str::random(60);

        $device = Device::create([
            'organization_id' => $organizationId,
            'name' => $request->name,
            'device_code' => $request->device_code,
            'access_token' => $accessToken,
        ]);

        return response()->json([
            'message' => 'デバイスを登録しました。',
            'data' => [
                'id' => $device->id,
                'name' => $device->name,
                'device_code' => $device->device_code,
                'access_token' => $accessToken,
            ]
        ], 201);
    }

    /**
     * Authenticate kiosk device and issue JWT token.
     */
    public function auth(DeviceAuthRequest $request): JsonResponse
    {
        $device = Device::where('device_code', $request->device_code)
            ->where('access_token', $request->access_token)
            ->first();

        if (!$device) {
            return response()->json(['message' => '認証情報が無効です。'], 401);
        }

        // Find a user in the device's organization to issue JWT fromUser
        $user = User::whereHas('organizations', function ($query) use ($device) {
            $query->where('organizations.id', $device->organization_id);
        })->first();

        if (!$user) {
            return response()->json(['message' => '該当の組織に所属するユーザーが見つかりません。'], 404);
        }

        // Generate JWT scoped to organization and device_id
        $accessToken = auth()
            ->claims([
                'organization_id' => $device->organization_id,
                'device_id' => $device->id,
                'role' => 'guest' // guest role for device session
            ])
            ->setTTL(525600) // Keep session alive (e.g. 1 year) for tablet
            ->fromUser($user);

        return response()->json([
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'device' => [
                'id' => $device->id,
                'name' => $device->name,
                'device_code' => $device->device_code,
                'organization_id' => $device->organization_id,
            ]
        ]);
    }

    /**
     * Get list of registered devices.
     */
    public function index(): JsonResponse
    {
        $devices = Device::orderBy('name')->get();
        return response()->json(['data' => $devices]);
    }
}
