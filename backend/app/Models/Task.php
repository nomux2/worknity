<?php
 
namespace App\Models;
 
use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
 
class Task extends Model
{
    use HasFactory, Multitenant;
 
    protected $fillable = [
        'organization_id',
        'project_id',
        'name',
        'description',
        'assignee_id',
        'status', // todo, doing, done
        'due_date',
        'planned_hours',
        'actual_hours',
    ];
 
    protected $casts = [
        'due_date' => 'date:Y-m-d',
        'planned_hours' => 'float',
        'actual_hours' => 'float',
    ];
 
    /**
     * Organization relation.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
 
    /**
     * Project relation.
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
 
    /**
     * Assignee user relation.
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }
 
    /**
     * Repeat rule relation.
     */
    public function repeatRule(): HasOne
    {
        return $this->hasOne(TaskRepeatRule::class);
    }
 
    /**
     * Comments relation.
     */
    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class);
    }
}
