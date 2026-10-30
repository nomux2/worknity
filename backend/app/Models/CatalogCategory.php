<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CatalogCategory extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'name',
        'sort_order',
    ];

    /**
     * Get the active organization this category belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the catalog items inside this category.
     */
    public function items(): HasMany
    {
        return $this->hasMany(CatalogItem::class, 'category_id')->orderBy('sort_order');
    }
}
