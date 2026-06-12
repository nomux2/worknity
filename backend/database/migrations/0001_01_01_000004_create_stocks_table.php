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
        Schema::create('stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('restrict')->onUpdate('cascade');
            $table->string('product_name');
            $table->integer('quantity')->default(0);
            $table->integer('minimum_quantity')->default(0);
            $table->json('attributes')->nullable();
            $table->timestamps();

            // インデックス
            $table->index('organization_id', 'idx_stocks_organization_id');
            $table->index(['organization_id', 'product_name'], 'idx_stocks_organization_product');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stocks');
    }
};
