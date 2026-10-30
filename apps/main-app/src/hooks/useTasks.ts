import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Task, TaskComment, CalendarHoliday } from '../types/task';
 
export const useTasks = (addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void) => {
    const { fetchWithAuth } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
 
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [loadingComments, setLoadingComments] = useState<boolean>(false);
 
    const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
    const [loadingHolidays, setLoadingHolidays] = useState<boolean>(false);
    const [workingDays, setWorkingDays] = useState<string>('1,2,3,4,5');
 
    const fetchTasks = useCallback(async (projectId?: number | string | null, statusFilter = '') => {
        setLoadingTasks(true);
        try {
            let url = '/api/tasks';
            const params: string[] = [];
 
            if (projectId !== undefined) {
                // Ensure 0 is passed for project-less filter
                params.push(`project_id=${projectId === null ? '0' : projectId}`);
            }
            if (statusFilter) {
                params.push(`status=${statusFilter}`);
            }
 
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }
 
            const res = await fetchWithAuth(url);
            if (res.ok) {
                const payload = await res.json();
                setTasks(payload.data || []);
            } else {
                addToast('タスク一覧の取得に失敗しました。', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('タスク一覧の取得に失敗しました。', 'error');
        } finally {
            setLoadingTasks(false);
        }
    }, [fetchWithAuth, addToast]);
 
    const createTask = async (data: {
        project_id: number | null;
        name: string;
        description?: string;
        assignee_id?: number | null;
        status?: string;
        due_date?: string;
        planned_hours?: number;
        repeat_rule?: {
            pattern: string;
            details?: any;
            non_working_day_behavior: string;
        } | null;
    }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const payload = await res.json();
            if (res.ok) {
                addToast('タスクを作成しました。');
                return true;
            } else {
                addToast(payload.message || 'タスクの作成に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('タスクの作成に失敗しました。', 'error');
            return false;
        }
    };
 
    const updateTask = async (id: number, data: {
        project_id?: number | null;
        name?: string;
        description?: string;
        assignee_id?: number | null;
        status?: string;
        due_date?: string;
        planned_hours?: number;
        actual_hours?: number;
        repeat_rule?: {
            pattern: string;
            details?: any;
            non_working_day_behavior: string;
        } | null;
    }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const payload = await res.json();
            if (res.ok) {
                addToast('タスクを更新しました。');
                return true;
            } else {
                addToast(payload.message || 'タスクの更新に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('タスクの更新に失敗しました。', 'error');
            return false;
        }
    };
 
    const deleteTask = async (id: number): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/tasks/${id}`, {
                method: 'DELETE',
            });
            const payload = await res.json();
            if (res.ok) {
                addToast('タスクを削除しました。');
                return true;
            } else {
                addToast(payload.message || 'タスクの削除に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('タスクの削除に失敗しました。', 'error');
            return false;
        }
    };
 
    const fetchComments = useCallback(async (taskId: number) => {
        setLoadingComments(true);
        try {
            const res = await fetchWithAuth(`/api/tasks/${taskId}/comments`);
            if (res.ok) {
                const payload = await res.json();
                setComments(payload.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingComments(false);
        }
    }, [fetchWithAuth]);
 
    const postComment = async (taskId: number, data: {
        content: string;
        importance?: string;
        type?: string;
        related_task_id?: number | null;
    }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/tasks/${taskId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const payload = await res.json();
            if (res.ok) {
                // Optimistic UI updates are managed in view component, but fetch latest is safer
                fetchComments(taskId);
                return true;
            } else {
                addToast(payload.message || 'コメントの投稿に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('コメントの投稿に失敗しました。', 'error');
            return false;
        }
    };
 
    const cleanupComments = async (data: {
        before_days: number;
        types: string[];
        importances: string[];
    }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/comments/cleanup', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const payload = await res.json();
            if (res.ok) {
                addToast(payload.message || 'コメントをクリーンアップしました。');
                return true;
            } else {
                addToast(payload.message || 'クリーンアップに失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('クリーンアップに失敗しました。', 'error');
            return false;
        }
    };
 
    const fetchHolidays = useCallback(async () => {
        setLoadingHolidays(true);
        try {
            const res = await fetchWithAuth('/api/calendar-holidays');
            if (res.ok) {
                const payload = await res.json();
                setHolidays(payload.data || []);
                if (payload.working_days) {
                    setWorkingDays(payload.working_days);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHolidays(false);
        }
    }, [fetchWithAuth]);
 
    const createHoliday = async (holiday_date: string, name: string): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/calendar-holidays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ holiday_date, name }),
            });
            const payload = await res.json();
            if (res.ok) {
                addToast('休日を登録しました。');
                fetchHolidays();
                return true;
            } else {
                addToast(payload.message || '休日の登録に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('休日の登録に失敗しました。', 'error');
            return false;
        }
    };
 
    const deleteHoliday = async (id: number): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/calendar-holidays/${id}`, {
                method: 'DELETE',
            });
            const payload = await res.json();
            if (res.ok) {
                addToast('休日設定を削除しました。');
                fetchHolidays();
                return true;
            } else {
                addToast(payload.message || '休日設定の削除に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('休日設定の削除に失敗しました。', 'error');
            return false;
        }
    };
 
    const updateWorkingDays = async (workingDaysStr: string): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/calendar-holidays/working-days', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ working_days: workingDaysStr }),
            });
            const payload = await res.json();
            if (res.ok) {
                addToast('稼働曜日を更新しました。');
                if (payload.working_days) {
                    setWorkingDays(payload.working_days);
                }
                return true;
            } else {
                addToast(payload.message || '稼働曜日の更新に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('稼働曜日の更新に失敗しました。', 'error');
            return false;
        }
    };

    return {
        tasks,
        setTasks,
        loadingTasks,
        fetchTasks,
        createTask,
        updateTask,
        deleteTask,
        comments,
        setComments,
        loadingComments,
        fetchComments,
        postComment,
        cleanupComments,
        holidays,
        loadingHolidays,
        fetchHolidays,
        createHoliday,
        deleteHoliday,
        workingDays,
        updateWorkingDays,
    };
};
