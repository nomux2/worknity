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
        Schema::create('report_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('report_id')->constrained('reports')->onDelete('cascade');
            $table->integer('step_number'); // 対象のステップ番号
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('action', 50); // approved, rejected
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'report_id'], 'idx_approvals_org_report');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('report_approvals');
    }
};
