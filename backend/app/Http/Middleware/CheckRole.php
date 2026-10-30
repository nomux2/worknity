<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }

        $organizationId = auth()->payload()->get('organization_id');
        $activeOrg = $user->organizations->firstWhere('id', $organizationId);

        \Illuminate\Support\Facades\Log::info('CheckRole Debug:', [
            'user_id' => $user->id,
            'org_id' => $organizationId,
            'active_org' => $activeOrg ? $activeOrg->toArray() : null,
            'pivot_role' => $activeOrg && $activeOrg->pivot ? $activeOrg->pivot->role : null,
            'expected_role' => $role
        ]);

        if (!$activeOrg || $activeOrg->pivot->role !== $role) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }

        return $next($request);
    }
}
