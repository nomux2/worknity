<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\StockController;
use Illuminate\Support\Facades\Route;

// Public Auth routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/refresh', [AuthController::class, 'refresh']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

// WebAuthn Public login routes
Route::middleware([\Illuminate\Session\Middleware\StartSession::class])->group(function () {
    Route::post('/auth/passkey/login/options', [AuthController::class, 'passkeyLoginOptions']);
    Route::post('/auth/passkey/login', [AuthController::class, 'passkeyLogin']);
});

// Social Login routes (Mock)
Route::get('/auth/social/{provider}/redirect', [AuthController::class, 'socialRedirect']);
Route::get('/auth/social/{provider}/callback', [AuthController::class, 'socialCallback']);

// Protected routes (JWT api guard)
Route::middleware('auth:api')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/organization/setup', [AuthController::class, 'setup']);
    Route::post('/auth/organization/switch', [AuthController::class, 'switchOrganization']);

    // WebAuthn Protected registration routes (requires JWT auth + Session for challenge)
    Route::middleware([\Illuminate\Session\Middleware\StartSession::class])->group(function () {
        Route::post('/auth/passkey/register/options', [AuthController::class, 'passkeyRegisterOptions']);
        Route::post('/auth/passkey/register', [AuthController::class, 'passkeyRegister']);
    });

    // Stocks routes
    Route::get('/stocks', [StockController::class, 'index']);
    Route::post('/stocks', [StockController::class, 'store']);
    Route::post('/stocks/{id}/inflow', [StockController::class, 'inflow']);
    Route::post('/stocks/{id}/outflow', [StockController::class, 'outflow']);
    Route::put('/stocks/{id}/stocktake', [StockController::class, 'stocktake']);
});
