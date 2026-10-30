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
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('project_id')->nullable()->constrained('projects')->onDelete('set null');
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('status', 50)->default('todo'); // todo, doing, done
            $table->date('due_date')->nullable();
            $table->decimal('planned_hours', 5, 1)->nullable();
            $table->decimal('actual_hours', 5, 1)->nullable();
            $table->timestamps();
 
            // Multi-tenant indexes
            $table->index('organization_id');
            $table->index(['organization_id', 'project_id']);
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'due_date']);
        });
    }
 
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
