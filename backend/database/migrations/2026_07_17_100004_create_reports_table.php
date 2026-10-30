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
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('report_template_id')->constrained('report_templates')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('status', 50)->default('draft'); // draft, pending, awaiting_input, approved, rejected
            $table->integer('current_step')->default(1);
            $table->json('attributes'); // 画面項目の入力値
            
            // ポリモーフィック関連
            $table->string('approvable_type', 100)->nullable();
            $table->unsignedBigInteger('approvable_id')->nullable();

            $table->timestamps();

            $table->index(['organization_id', 'user_id', 'status'], 'idx_reports_org_user');
            $table->index(['organization_id', 'status', 'current_step'], 'idx_reports_org_status');
            $table->index(['organization_id', 'approvable_type', 'approvable_id'], 'idx_reports_approvable');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
