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
        Schema::create('stock_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('restrict')->onUpdate('cascade');
            $table->foreignId('stock_id')->constrained('stocks')->onDelete('cascade')->onUpdate('cascade');
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null')->onUpdate('cascade');
            $table->string('operation', 50);
            $table->integer('prior_quantity');
            $table->integer('new_quantity');
            $table->timestamps();

            // 複合インデックス
            $table->index(['organization_id', 'stock_id', 'created_at'], 'idx_stock_logs_organization_stock');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_logs');
    }
};
