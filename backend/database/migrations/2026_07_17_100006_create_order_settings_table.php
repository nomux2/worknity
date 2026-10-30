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
        Schema::create('order_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained('organizations')->onDelete('cascade');
            $table->boolean('require_approval')->default(false); // 1: 承認必須, 0: 承認不要
            $table->integer('approval_threshold')->nullable(); // 承認が必要な発注合計金額の最小値
            $table->foreignId('report_template_id')->nullable()->constrained('report_templates')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_settings');
    }
};
