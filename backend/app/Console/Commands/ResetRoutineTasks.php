<?php
 
namespace App\Console\Commands;
 
use App\Models\CalendarHoliday;
use App\Models\Organization;
use App\Models\Task;
use App\Models\TaskRepeatRule;
use Carbon\Carbon;
use Illuminate\Console\Command;
 
class ResetRoutineTasks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'task:reset-routines';
 
    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset done daily routine tasks back to todo status based on working days calendar';
 
    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting routine tasks status reset...');
        $today = Carbon::today();
 
        // Load all active repeat rules for daily routines
        $rules = TaskRepeatRule::where('pattern', 'daily')->with(['task', 'organization'])->get();
 
        foreach ($rules as $rule) {
            $task = $rule->task;
            $org = $rule->organization;
 
            if (!$task || !$org) {
                continue;
            }
 
            // We only need to reset if it is currently "done"
            if ($task->status !== 'done') {
                continue;
            }
 
            $isWorking = $this->isWorkingDay($org, $today);
            $behavior = $rule->non_working_day_behavior;
 
            if (!$isWorking) {
                if ($behavior === 'skip') {
                    // Skip today: keep status as done, do not reset
                    continue;
                } elseif ($behavior === 'next_working_day') {
                    // Shift to next working day: find next date and set as due
                    $nextWorkingDate = $this->getNextWorkingDay($org, $today);
                    $task->update([
                        'status' => 'todo',
                        'due_date' => $nextWorkingDate->toDateString(),
                    ]);
                    $this->info("Reset task ID {$task->id} and shifted due date to {$nextWorkingDate->toDateString()}");
                    continue;
                } elseif ($behavior === 'prev_working_day') {
                    // Shift to previous working day (already passed, but reset it)
                    $prevWorkingDate = $this->getPrevWorkingDay($org, $today);
                    $task->update([
                        'status' => 'todo',
                        'due_date' => $prevWorkingDate->toDateString(),
                    ]);
                    $this->info("Reset task ID {$task->id} and shifted due date to {$prevWorkingDate->toDateString()}");
                    continue;
                }
            }
 
            // Normal working day or behavior is 'as_is'
            $task->update([
                'status' => 'todo',
                'due_date' => $today->toDateString(),
            ]);
            $this->info("Reset task ID {$task->id} to todo.");
        }
 
        $this->info('Routine tasks status reset complete.');
    }
 
    /**
     * Check if a given date is a working day for the organization.
     */
    private function isWorkingDay(Organization $org, Carbon $date): bool
    {
        // Carbon: 0 (Sunday) to 6 (Saturday).
        // Our DB representation: 1 (Monday) to 7 (Sunday).
        $dayOfWeek = $date->dayOfWeek;
        $dbDayOfWeek = $dayOfWeek === 0 ? 7 : $dayOfWeek;
 
        $workingDays = explode(',', $org->working_days);
        if (!in_array($dbDayOfWeek, $workingDays)) {
            return false;
        }
 
        // Check if there is an override holiday record for this date
        $isHoliday = CalendarHoliday::where('organization_id', $org->id)
            ->where('holiday_date', $date->toDateString())
            ->exists();
 
        return !$isHoliday;
    }
 
    /**
     * Get the next working day starting from target date.
     */
    private function getNextWorkingDay(Organization $org, Carbon $date): Carbon
    {
        $checkDate = $date->copy();
        do {
            $checkDate->addDay();
        } while (!$this->isWorkingDay($org, $checkDate));
 
        return $checkDate;
    }
 
    /**
     * Get the previous working day starting from target date.
     */
    private function getPrevWorkingDay(Organization $org, Carbon $date): Carbon
    {
        $checkDate = $date->copy();
        do {
            $checkDate->subDay();
        } while (!$this->isWorkingDay($org, $checkDate));
 
        return $checkDate;
    }
}
