import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Report, ReportTemplate, ApprovalClass, OrderSetting } from '../types/workflow';

export const useWorkflow = (addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void) => {
    const { fetchWithAuth } = useAuth();
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);

    const [classes, setClasses] = useState<ApprovalClass[]>([]);
    const [loadingClasses, setLoadingClasses] = useState<boolean>(false);

    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState<boolean>(false);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalReports, setTotalReports] = useState<number>(0);

    const [orderSettings, setOrderSettings] = useState<OrderSetting | null>(null);
    const [loadingSettings, setLoadingSettings] = useState<boolean>(false);

    // --- Templates ---
    const fetchTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        try {
            const res = await fetchWithAuth('/api/report-templates');
            if (res.ok) {
                const payload = await res.json();
                setTemplates(payload.data || []);
            } else {
                addToast('テンプレート一覧の取得に失敗しました。', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('テンプレート一覧の取得に失敗しました。', 'error');
        } finally {
            setLoadingTemplates(false);
        }
    }, [fetchWithAuth, addToast]);

    const createTemplate = async (data: Omit<Partial<ReportTemplate>, 'routes'> & { routes: any[] }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/report-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                addToast('テンプレートを作成しました。', 'success');
                fetchTemplates();
                return true;
            } else {
                const err = await res.json();
                addToast(err.message || 'テンプレートの作成に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('テンプレートの作成に失敗しました。', 'error');
            return false;
        }
    };

    const updateTemplate = async (id: number, data: Omit<Partial<ReportTemplate>, 'routes'> & { routes: any[] }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/report-templates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                addToast('テンプレートを更新しました。', 'success');
                fetchTemplates();
                return true;
            } else {
                const err = await res.json();
                addToast(err.message || 'テンプレートの更新に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('テンプレートの更新に失敗しました。', 'error');
            return false;
        }
    };

    const deleteTemplate = async (id: number): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/report-templates/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                addToast('テンプレートを削除しました。', 'success');
                fetchTemplates();
                return true;
            } else {
                addToast('テンプレートの削除に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('テンプレートの削除に失敗しました。', 'error');
            return false;
        }
    };

    // --- Approval Classes ---
    const fetchClasses = useCallback(async () => {
        setLoadingClasses(true);
        try {
            const res = await fetchWithAuth('/api/approval-classes');
            if (res.ok) {
                const payload = await res.json();
                setClasses(payload.data || []);
            } else {
                addToast('承認クラス一覧の取得に失敗しました。', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('承認クラス一覧の取得に失敗しました。', 'error');
        } finally {
            setLoadingClasses(false);
        }
    }, [fetchWithAuth, addToast]);

    const createClass = async (data: { name: string; priority: number }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/approval-classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                addToast('承認クラスを作成しました。', 'success');
                fetchClasses();
                return true;
            } else {
                addToast('承認クラスの作成に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('承認クラスの作成に失敗しました。', 'error');
            return false;
        }
    };

    const updateClass = async (id: number, data: { name: string; priority: number }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/approval-classes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                addToast('承認クラスを更新しました。', 'success');
                fetchClasses();
                return true;
            } else {
                addToast('承認クラスの更新に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('承認クラスの更新に失敗しました。', 'error');
            return false;
        }
    };

    const deleteClass = async (id: number): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/approval-classes/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                addToast('承認クラスを削除しました。', 'success');
                fetchClasses();
                return true;
            } else {
                addToast('承認クラスの削除に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('承認クラスの削除に失敗しました。', 'error');
            return false;
        }
    };

    const assignUserToClass = async (classId: number, userId: number): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/approval-classes/${classId}/assign-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });
            if (res.ok) {
                addToast('ユーザーを割り当てました。', 'success');
                return true;
            } else {
                const err = await res.json();
                addToast(err.message || '割り当てに失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('割り当てに失敗しました。', 'error');
            return false;
        }
    };

    const removeUserFromClass = async (classId: number, userId: number): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/approval-classes/${classId}/remove-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId }),
            });
            if (res.ok) {
                addToast('割り当てを解除しました。', 'success');
                return true;
            } else {
                addToast('解除に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('解除に失敗しました。', 'error');
            return false;
        }
    };

    // --- Reports ---
    const fetchReports = useCallback(async (tab: 'my' | 'pending' = 'my', page = 1) => {
        setLoadingReports(true);
        try {
            const res = await fetchWithAuth(`/api/reports?tab=${tab}&page=${page}`);
            if (res.ok) {
                const payload = await res.json();
                setReports(payload.data || []);
                setTotalPages(payload.meta?.last_page || 1);
                setTotalReports(payload.meta?.total || 0);
            } else {
                addToast('申請一覧の取得に失敗しました。', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('申請一覧の取得に失敗しました。', 'error');
        } finally {
            setLoadingReports(false);
        }
    }, [fetchWithAuth, addToast]);

    const fetchReport = useCallback(async (id: number | string): Promise<{ report: Report; approvable_data: any } | null> => {
        try {
            const res = await fetchWithAuth(`/api/reports/${id}`);
            if (res.ok) {
                const payload = await res.json();
                return {
                    report: payload.data,
                    approvable_data: payload.approvable_data
                };
            } else {
                addToast('申請詳細の取得に失敗しました。', 'error');
                return null;
            }
        } catch (e) {
            console.error(e);
            addToast('申請詳細の取得に失敗しました。', 'error');
            return null;
        }
    }, [fetchWithAuth, addToast]);

    const createReport = async (data: { report_template_id: number; status: 'draft' | 'pending'; attributes: any }): Promise<Report | null> => {
        try {
            const res = await fetchWithAuth('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                const payload = await res.json();
                addToast(data.status === 'pending' ? '申請を提出しました。' : '下書き保存しました。', 'success');
                return payload.data;
            } else {
                const err = await res.json();
                addToast(err.message || '申請の作成に失敗しました。', 'error');
                return null;
            }
        } catch (e) {
            console.error(e);
            addToast('申請の作成に失敗しました。', 'error');
            return null;
        }
    };

    const updateReport = async (id: number, data: { status: 'draft' | 'pending'; attributes: any }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/reports/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                addToast(data.status === 'pending' ? '申請を再提出しました。' : '下書きを更新しました。', 'success');
                return true;
            } else {
                const err = await res.json();
                addToast(err.message || '申請の更新に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('申請の更新に失敗しました。', 'error');
            return false;
        }
    };

    const approveReport = async (id: number, comment?: string): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/reports/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment }),
            });
            if (res.ok) {
                addToast('申請を承認しました。', 'success');
                return true;
            } else {
                const err = await res.json();
                addToast(err.message || '承認に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('承認に失敗しました。', 'error');
            return false;
        }
    };

    const rejectReport = async (id: number, comment: string): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/reports/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment }),
            });
            if (res.ok) {
                addToast('申請を却下しました。', 'success');
                return true;
            } else {
                const err = await res.json();
                addToast(err.message || '却下に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('却下に失敗しました。', 'error');
            return false;
        }
    };

    // --- Order Settings ---
    const fetchOrderSettings = useCallback(async () => {
        setLoadingSettings(true);
        try {
            const res = await fetchWithAuth('/api/purchase-orders/settings');
            if (res.ok) {
                const payload = await res.json();
                setOrderSettings(payload.data || null);
            } else {
                addToast('発注承認設定の取得に失敗しました。', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('発注承認設定の取得に失敗しました。', 'error');
        } finally {
            setLoadingSettings(false);
        }
    }, [fetchWithAuth, addToast]);

    const updateOrderSettings = async (data: { require_approval: boolean; approval_threshold?: number | null; report_template_id?: number | null }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/purchase-orders/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                const payload = await res.json();
                setOrderSettings(payload.data || null);
                addToast('発注承認設定を更新しました。', 'success');
                return true;
            } else {
                addToast('発注承認設定の更新に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('発注承認設定の更新に失敗しました。', 'error');
            return false;
        }
    };

    return {
        templates,
        loadingTemplates,
        fetchTemplates,
        createTemplate,
        updateTemplate,
        deleteTemplate,

        classes,
        loadingClasses,
        fetchClasses,
        createClass,
        updateClass,
        deleteClass,
        assignUserToClass,
        removeUserFromClass,

        reports,
        loadingReports,
        totalPages,
        totalReports,
        fetchReports,
        fetchReport,
        createReport,
        updateReport,
        approveReport,
        rejectReport,

        orderSettings,
        loadingSettings,
        fetchOrderSettings,
        updateOrderSettings,
    };
};
