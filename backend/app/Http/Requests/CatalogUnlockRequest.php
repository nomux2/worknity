<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CatalogUnlockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check(); // Requires device or staff auth
    }

    public function rules(): array
    {
        return [
            'unlock_password' => 'required|string',
        ];
    }
}
