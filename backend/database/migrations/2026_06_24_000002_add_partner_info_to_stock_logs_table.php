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
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->string('partner_name')->nullable()->after('new_quantity');
            $table->string('partner_address')->nullable()->after('partner_name');
            $table->string('partner_phone', 50)->nullable()->after('partner_address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_logs', function (Blueprint $table) {
            $table->dropColumn(['partner_name', 'partner_address', 'partner_phone']);
        });
    }
};
