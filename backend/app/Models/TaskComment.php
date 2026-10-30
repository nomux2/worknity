<?php
 
namespace App\Models;
 
use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
 
class TaskComment extends Model
{
    use HasFactory, Multitenant;
 
    protected $fillable = [
        'organization_id',
        'task_id',
        'user_id',
        'content',
        'importance', // low, medium, high
        'type', // communication, handover, log, memo
        'related_task_id',
    ];
 
    /**
     * Organization relation.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
 
    /**
     * Task relation.
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
 
    /**
     * User relation.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
 
    /**
     * Related task relation.
     */
    public function relatedTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'related_task_id');
    }
}
