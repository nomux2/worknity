<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait Multitenant
{
    /**
     * Boot the multitenant trait.
     */
    public static function bootMultitenant(): void
    {
        // Automatically scope all queries by active organization_id in JWT payload
        static::addGlobalScope('organization', function (Builder $builder) {
            if (auth()->check()) {
                try {
                    $organizationId = auth()->payload()->get('organization_id');
                    if ($organizationId) {
                        $builder->where($builder->getModel()->getTable() . '.organization_id', $organizationId);
                    }
                } catch (\Exception $e) {
                    // Fail-safe: fallback if JWT payload cannot be parsed (e.g. during CLI or tests)
                }
            }
        });

        // Automatically set organization_id on model creation
        static::creating(function ($model) {
            if (auth()->check()) {
                try {
                    $organizationId = auth()->payload()->get('organization_id');
                    if ($organizationId && !$model->organization_id) {
                        $model->organization_id = $organizationId;
                    }
                } catch (\Exception $e) {
                }
            }
        });
    }
}
