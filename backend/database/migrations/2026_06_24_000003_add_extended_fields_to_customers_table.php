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
        Schema::table('customers', function (Blueprint $table) {
            $table->string('kana')->after('name');
            $table->string('postal_code', 20)->nullable()->after('email');
            $table->json('attributes')->nullable()->after('address');

            // Indexes
            $table->index(['organization_id', 'kana']);
            $table->index(['organization_id', 'phone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'kana']);
            $table->dropIndex(['organization_id', 'phone']);
            $table->dropColumn(['kana', 'postal_code', 'attributes']);
        });
    }
};
