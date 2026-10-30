<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'device_code',
        'name',
        'access_token',
    ];

    /**
     * Get the active organization this device belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the orders placed from this device.
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
