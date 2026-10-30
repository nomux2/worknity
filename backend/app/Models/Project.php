<?php
 
namespace App\Models;
 
use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
 
class Project extends Model
{
    use HasFactory, Multitenant;
 
    protected $fillable = [
        'organization_id',
        'name',
        'description',
        'status', // planned, active, completed, suspended
        'start_date',
        'end_date',
        'budget_hours',
    ];
 
    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
        'budget_hours' => 'integer',
    ];
 
    protected $appends = [
        'actual_hours_sum',
        'total_tasks_count',
        'completed_tasks_count',
        'progress_rate',
    ];
 
    /**
     * Organization relation.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
 
    /**
     * Tasks relation.
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }
 
    /**
     * Accessor for actual hours sum.
     */
    public function getActualHoursSumAttribute(): float
    {
        return (float) $this->tasks()->sum('actual_hours');
    }
 
    /**
     * Accessor for total tasks count.
     */
    public function getTotalTasksCountAttribute(): int
    {
        return $this->tasks()->count();
    }
 
    /**
     * Accessor for completed tasks count.
     */
    public function getCompletedTasksCountAttribute(): int
    {
        return $this->tasks()->where('status', 'done')->count();
    }
 
    /**
     * Accessor for progress rate (%).
     */
    public function getProgressRateAttribute(): int
    {
        $total = $this->total_tasks_count;
        if ($total <= 0) {
            return 0;
        }
 
        return (int) round(($this->completed_tasks_count / $total) * 100);
    }
}
