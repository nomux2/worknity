<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CatalogItem extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'category_id',
        'name',
        'description',
        'price',
        'image_path',
        'sort_order',
        'attributes',
    ];

    protected $casts = [
        'attributes' => 'array',
    ];

    /**
     * Get the active organization this item belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the category this item belongs to.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(CatalogCategory::class, 'category_id');
    }
}
