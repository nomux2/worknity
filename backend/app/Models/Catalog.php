<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Catalog extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'unlock_password',
        'show_price',
        'device_label',
    ];

    protected $casts = [
        'show_price' => 'boolean',
    ];

    /**
     * Get the active organization this catalog config belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
