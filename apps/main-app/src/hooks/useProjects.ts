import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types/project';
 
export const useProjects = (addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void) => {
    const { fetchWithAuth } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
 
    const fetchProjects = useCallback(async (statusFilter = '') => {
        setLoadingProjects(true);
        try {
            const url = statusFilter ? `/api/projects?status=${statusFilter}` : '/api/projects';
            const res = await fetchWithAuth(url);
            if (res.ok) {
                const payload = await res.json();
                setProjects(payload.data || []);
            } else {
                addToast('プロジェクト一覧の取得に失敗しました。', 'error');
            }
        } catch (e) {
            console.error(e);
            addToast('プロジェクト一覧の取得に失敗しました。', 'error');
        } finally {
            setLoadingProjects(false);
        }
    }, [fetchWithAuth, addToast]);
 
    const createProject = async (data: {
        name: string;
        description?: string;
        status?: Project['status'];
        start_date?: string;
        end_date?: string;
        budget_hours?: number;
    }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
 
            const payload = await res.json();
 
            if (res.ok) {
                addToast('プロジェクトを作成しました。');
                fetchProjects();
                return true;
            } else {
                addToast(payload.message || 'プロジェクトの作成に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('プロジェクトの作成に失敗しました。', 'error');
            return false;
        }
    };
 
    const updateProject = async (id: number, data: {
        name?: string;
        description?: string;
        status?: string;
        start_date?: string;
        end_date?: string;
        budget_hours?: number;
    }): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
 
            const payload = await res.json();
 
            if (res.ok) {
                addToast('プロジェクトを更新しました。');
                fetchProjects();
                return true;
            } else {
                addToast(payload.message || 'プロジェクトの更新に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('プロジェクトの更新に失敗しました。', 'error');
            return false;
        }
    };
 
    const deleteProject = async (id: number): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/projects/${id}`, {
                method: 'DELETE',
            });
 
            const payload = await res.json();
 
            if (res.ok) {
                addToast('プロジェクトを削除しました。');
                fetchProjects();
                return true;
            } else {
                addToast(payload.message || 'プロジェクトの削除に失敗しました。', 'error');
                return false;
            }
        } catch (e) {
            console.error(e);
            addToast('プロジェクトの削除に失敗しました。', 'error');
            return false;
        }
    };
 
    return {
        projects,
        loadingProjects,
        fetchProjects,
        createProject,
        updateProject,
        deleteProject,
    };
};
