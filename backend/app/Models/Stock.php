<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stock extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'product_name',
        'quantity',
        'minimum_quantity',
        'attributes',
        'jan_code',
        'description',
        'image_url',
        'price',
        'brand_name',
        'category_name',
    ];

    protected $casts = [
        'attributes' => 'array',
    ];

    /**
     * Appends to JSON serialization.
     */
    protected $appends = [
        'recent_quantities',
    ];

    /**
     * Get the active organization this stock belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the change logs for this stock.
     */
    public function logs(): HasMany
    {
        return $this->hasMany(StockLog::class);
    }

    /**
     * Accessor to get recent quantity changes (max 7 items, chronological order).
     * Useful for sparkline rendering.
     */
    public function getRecentQuantitiesAttribute(): array
    {
        // Get the latest 7 logs, pluck the new_quantity and sort oldest to newest
        return $this->logs()
            ->latest('id')
            ->limit(7)
            ->get()
            ->reverse()
            ->pluck('new_quantity')
            ->toArray();
    }
}
