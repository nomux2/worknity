<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CatalogConfigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check(); // Requires admin/staff auth
    }

    public function rules(): array
    {
        return [
            'unlock_password' => 'required|string|max:50',
            'show_price' => 'required|boolean',
            'device_label' => 'required|string|max:50',
        ];
    }
}
