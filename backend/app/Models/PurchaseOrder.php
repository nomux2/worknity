<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'partner_id',
        'order_number',
        'order_date',
        'delivery_deadline',
        'status',
        'created_by',
    ];

    /**
     * Get the active organization this purchase order belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the partner (supplier) for this purchase order.
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    /**
     * Get the user who created this purchase order.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the items in this purchase order.
     */
    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class, 'order_id');
    }

    /**
     * Get the related report (from approval flow).
     */
    public function report(): \Illuminate\Database\Eloquent\Relations\MorphOne
    {
        return $this->morphOne('App\Models\Report', 'approvable');
    }

    /**
     * Handle workflow approval event.
     */
    public function onWorkflowApproved(Report $report): void
    {
        $this->update(['status' => 'ordered']);
    }

    /**
     * Handle workflow rejection event.
     */
    public function onWorkflowRejected(Report $report): void
    {
        $this->update(['status' => 'draft']);
    }
}
