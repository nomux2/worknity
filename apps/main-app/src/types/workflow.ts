export interface ApprovalClass {
    id: number;
    organization_id: number;
    name: string;
    priority: number;
    users_count?: number;
    users?: any[];
    created_at: string;
    updated_at: string;
}

export interface ReportApprovalRoute {
    id: number;
    organization_id: number;
    report_template_id: number;
    step_number: number;
    approver_type: 'class' | 'user';
    approval_class_id?: number | null;
    approver_user_id?: number | null;
    approval_class?: ApprovalClass | null;
    approver_user?: any | null;
    created_at?: string;
    updated_at?: string;
}

export interface ReportTemplate {
    id: number;
    organization_id: number;
    name: string;
    description?: string;
    type: 'report' | 'application';
    steps_count: number;
    fields: any[]; // JSON array
    routes?: ReportApprovalRoute[];
    created_at: string;
    updated_at: string;
}

export interface ReportApproval {
    id: number;
    organization_id: number;
    report_id: number;
    step_number: number;
    user_id: number;
    action: 'approved' | 'rejected';
    comment?: string;
    user?: any; // user info
    created_at: string;
    updated_at: string;
}

export interface Report {
    id: number;
    organization_id: number;
    report_template_id: number;
    user_id: number;
    status: 'draft' | 'pending' | 'awaiting_input' | 'approved' | 'rejected';
    current_step: number;
    attributes: Record<string, any>;
    approvable_type?: string | null;
    approvable_id?: number | null;
    template?: ReportTemplate;
    user?: any;
    approvals?: ReportApproval[];
    created_at: string;
    updated_at: string;
}

export interface OrderSetting {
    id: number;
    organization_id: number;
    require_approval: boolean;
    approval_threshold?: number | null;
    report_template_id?: number | null;
    created_at?: string;
    updated_at?: string;
}
