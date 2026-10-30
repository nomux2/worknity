<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\StockController;
use Illuminate\Support\Facades\Route;

// Public Auth routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/refresh', [AuthController::class, 'refresh']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

// Public Device Auth route
Route::post('/catalog/devices/auth', [\App\Http\Controllers\DeviceController::class, 'auth']);

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
    Route::get('/stocks/{id}/history', [StockController::class, 'history']);

    // Attendance routes
    Route::get('/attendances', [\App\Http\Controllers\AttendanceController::class, 'index']);
    Route::post('/attendances/clock-in', [\App\Http\Controllers\AttendanceController::class, 'clockIn']);
    Route::post('/attendances/clock-out', [\App\Http\Controllers\AttendanceController::class, 'clockOut']);

    // Attendance request routes
    Route::get('/attendance-requests', [\App\Http\Controllers\AttendanceController::class, 'indexRequests']);
    Route::post('/attendance-requests', [\App\Http\Controllers\AttendanceController::class, 'storeRequest']);
    Route::put('/attendance-requests/{id}/approve', [\App\Http\Controllers\AttendanceController::class, 'approveRequest']);
    Route::put('/attendance-requests/{id}/reject', [\App\Http\Controllers\AttendanceController::class, 'rejectRequest']);

    // User routes
    Route::get('/users', [\App\Http\Controllers\UserController::class, 'index']);
    Route::post('/users', [\App\Http\Controllers\UserController::class, 'store']);

    // Partner routes
    Route::apiResource('/partners', \App\Http\Controllers\PartnerController::class);

    // Customer routes
    Route::apiResource('/customers', \App\Http\Controllers\CustomerController::class);
    Route::apiResource('/customer-fields', \App\Http\Controllers\CustomerFieldController::class);

    // Stock update/delete routes (for master management)
    Route::put('/stocks/{id}', [\App\Http\Controllers\StockController::class, 'update']);
    Route::delete('/stocks/{id}', [\App\Http\Controllers\StockController::class, 'destroy']);

    // Project routes
    Route::apiResource('/projects', \App\Http\Controllers\ProjectController::class);

    // Task routes
    Route::apiResource('/tasks', \App\Http\Controllers\TaskController::class);

    // Task comment routes
    Route::get('/tasks/{id}/comments', [\App\Http\Controllers\TaskCommentController::class, 'index']);
    Route::post('/tasks/{id}/comments', [\App\Http\Controllers\TaskCommentController::class, 'store']);
    Route::delete('/comments/cleanup', [\App\Http\Controllers\TaskCommentController::class, 'cleanup']);

    // Calendar holiday routes
    Route::get('/calendar-holidays', [\App\Http\Controllers\CalendarHolidayController::class, 'index']);
    Route::post('/calendar-holidays', [\App\Http\Controllers\CalendarHolidayController::class, 'store']);
    Route::put('/calendar-holidays/working-days', [\App\Http\Controllers\CalendarHolidayController::class, 'updateWorkingDays']);
    Route::delete('/calendar-holidays/{id}', [\App\Http\Controllers\CalendarHolidayController::class, 'destroy']);

    // Catalog & Ordering routes
    Route::post('/catalog/devices/register', [\App\Http\Controllers\DeviceController::class, 'register']);
    Route::get('/catalog/devices', [\App\Http\Controllers\DeviceController::class, 'index']);
    
    Route::get('/catalog/config', [\App\Http\Controllers\CatalogController::class, 'getConfig']);
    Route::put('/catalog/config', [\App\Http\Controllers\CatalogController::class, 'updateConfig']);
    Route::post('/catalog/unlock', [\App\Http\Controllers\CatalogController::class, 'unlock']);
    
    Route::get('/catalog/categories', [\App\Http\Controllers\CatalogController::class, 'getCatalog']);
    Route::post('/catalog/categories', [\App\Http\Controllers\CatalogController::class, 'storeCategory']);
    Route::delete('/catalog/categories/{id}', [\App\Http\Controllers\CatalogController::class, 'destroyCategory']);
    
    Route::post('/catalog/items', [\App\Http\Controllers\CatalogController::class, 'storeItem']);
    Route::delete('/catalog/items/{id}', [\App\Http\Controllers\CatalogController::class, 'destroyItem']);
    
    Route::post('/catalog/orders', [\App\Http\Controllers\OrderController::class, 'store']);
    Route::get('/catalog/orders', [\App\Http\Controllers\OrderController::class, 'index']);
    Route::put('/catalog/orders/{id}/status', [\App\Http\Controllers\OrderController::class, 'updateStatus']);

    // Addons management
    Route::get('/settings/addons', [\App\Http\Controllers\AddonController::class, 'index']);
    Route::put('/settings/addons', [\App\Http\Controllers\AddonController::class, 'update'])->middleware('role:admin');

    // Purchase Orders management
    Route::get('/purchase-orders/settings', [\App\Http\Controllers\PurchaseOrderController::class, 'getSettings']);
    Route::put('/purchase-orders/settings', [\App\Http\Controllers\PurchaseOrderController::class, 'updateSettings'])->middleware('role:admin');
    Route::get('/purchase-orders', [\App\Http\Controllers\PurchaseOrderController::class, 'index']);
    Route::post('/purchase-orders', [\App\Http\Controllers\PurchaseOrderController::class, 'store'])->middleware('role:admin');
    Route::get('/purchase-orders/{id}', [\App\Http\Controllers\PurchaseOrderController::class, 'show']);
    Route::put('/purchase-orders/{id}', [\App\Http\Controllers\PurchaseOrderController::class, 'update'])->middleware('role:admin');
    Route::delete('/purchase-orders/{id}', [\App\Http\Controllers\PurchaseOrderController::class, 'destroy'])->middleware('role:admin');
    Route::put('/purchase-orders/{id}/status', [\App\Http\Controllers\PurchaseOrderController::class, 'updateStatus'])->middleware('role:admin');
    Route::post('/purchase-orders/{id}/receive', [\App\Http\Controllers\PurchaseOrderController::class, 'receive']);

    // Workflow & Approval system routes
    Route::apiResource('/report-templates', \App\Http\Controllers\ReportTemplateController::class);
    Route::apiResource('/approval-classes', \App\Http\Controllers\ApprovalClassController::class);
    Route::post('/approval-classes/{id}/assign-user', [\App\Http\Controllers\ApprovalClassController::class, 'assignUser']);
    Route::post('/approval-classes/{id}/remove-user', [\App\Http\Controllers\ApprovalClassController::class, 'removeUser']);

    Route::get('/reports', [\App\Http\Controllers\ReportController::class, 'index']);
    Route::post('/reports', [\App\Http\Controllers\ReportController::class, 'store']);
    Route::get('/reports/{id}', [\App\Http\Controllers\ReportController::class, 'show']);
    Route::put('/reports/{id}', [\App\Http\Controllers\ReportController::class, 'update']);
    Route::post('/reports/{id}/approve', [\App\Http\Controllers\ReportController::class, 'approve']);
    Route::post('/reports/{id}/reject', [\App\Http\Controllers\ReportController::class, 'reject']);
});

