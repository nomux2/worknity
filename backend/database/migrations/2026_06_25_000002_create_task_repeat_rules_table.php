<?php
 
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
 
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('task_repeat_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
            $table->string('pattern', 50); // daily, weekly, biweekly, monthly, first_day_of_month, last_day_of_month
            $table->json('details')->nullable(); // e.g. days_of_week
            $table->string('non_working_day_behavior', 50)->default('as_is'); // as_is, next_working_day, prev_working_day, skip
            $table->timestamps();
 
            // Indexes
            $table->index('organization_id');
            $table->unique(['organization_id', 'task_id'], 'uk_repeat_rules_org_task');
        });
    }
 
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_repeat_rules');
    }
};
