<?php
 
namespace App\Models;
 
use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
 
class TaskRepeatRule extends Model
{
    use HasFactory, Multitenant;
 
    protected $fillable = [
        'organization_id',
        'task_id',
        'pattern', // daily, weekly, biweekly, monthly, first_day_of_month, last_day_of_month
        'details', // json configuration (e.g. days_of_week)
        'non_working_day_behavior', // as_is, next_working_day, prev_working_day, skip
    ];
 
    protected $casts = [
        'details' => 'array',
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
}
