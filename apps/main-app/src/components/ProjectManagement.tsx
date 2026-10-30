import React, { useState, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import type { Project } from '../types/project';
import { Input } from './ui/Input';
import { TextArea } from './ui/TextArea';
 
interface ProjectManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  isAdmin: boolean;
}
 
export const ProjectManagement: React.FC<ProjectManagementProps> = ({ addToast, isAdmin }) => {
  const {
    projects,
    loadingProjects,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  } = useProjects(addToast);
 
  // View states
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
 
  // Form fields states
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<string>('planned');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [budgetHours, setBudgetHours] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
 
  useEffect(() => {
    fetchProjects(filterStatus);
  }, [filterStatus, fetchProjects]);
 
  const handleOpenAddModal = () => {
    setName('');
    setDescription('');
    setStatus('planned');
    setStartDate('');
    setEndDate('');
    setBudgetHours('');
    setShowAddModal(true);
  };
 
  const handleOpenEditModal = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click trigger
    setName(project.name);
    setDescription(project.description || '');
    setStatus(project.status);
    setStartDate(project.start_date || '');
    setEndDate(project.end_date || '');
    setBudgetHours(project.budget_hours ? String(project.budget_hours) : '');
    setSelectedProject(project);
    setShowEditModal(true);
  };
 
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
 
    const success = await createProject({
      name,
      description: description || undefined,
      status: (status || undefined) as Project['status'],
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      budget_hours: budgetHours ? Number(budgetHours) : undefined,
    });
 
    setIsSubmitting(false);
    if (success) {
      setShowAddModal(false);
    }
  };
 
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !name.trim()) return;
    setIsSubmitting(true);
 
    const success = await updateProject(selectedProject.id, {
      name,
      description,
      status: status as Project['status'],
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      budget_hours: budgetHours ? Number(budgetHours) : undefined,
    });
 
    setIsSubmitting(false);
    if (success) {
      setShowEditModal(false);
      // Update local detailed view if currently opened
      if (selectedProject && selectedProject.id === selectedProject.id) {
        // Just reload project list to get updated metrics
        fetchProjects(filterStatus);
        setSelectedProject(prev => prev ? { ...prev, name, description, status: status as Project['status'], start_date: startDate || null, end_date: endDate || null, budget_hours: budgetHours ? Number(budgetHours) : null } : null);
      }
    }
  };
 
  const handleDelete = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`プロジェクト「${project.name}」を削除しますか？\n紐づいていたタスクは削除されず「プロジェクトなし」になります。`)) {
      return;
    }
 
    const success = await deleteProject(project.id);
    if (success && selectedProject?.id === project.id) {
      setSelectedProject(null);
    }
  };
 
  // Render status badge helper
  const renderStatusBadge = (statusVal: string) => {
    let label = '未着手';
    let className = 'badge-secondary';
    if (statusVal === 'active') { label = '進行中'; className = 'badge-primary'; }
    else if (statusVal === 'completed') { label = '完了'; className = 'badge-success'; }
    else if (statusVal === 'suspended') { label = '保留'; className = 'badge-warning'; }
 
    return <span className={`badge ${className}`}>{label}</span>;
  };
 
  return (
    <div className="tab-pane-container">
      {selectedProject ? (
        // Detailed Dashboard View
        <div className="project-detail-dashboard">
          <div className="detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedProject(null)} style={{ marginRight: '1rem' }}>
                &larr; 戻る
              </button>
              <h2 style={{ display: 'inline-block', margin: 0 }}>{selectedProject.name}</h2>
            </div>
            {isAdmin && (
              <button className="btn btn-primary" onClick={(e) => handleOpenEditModal(selectedProject, e)}>
                プロジェクトを編集
              </button>
            )}
          </div>
 
          <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Info Card */}
            <div className="card shadow-subtle" style={{ padding: '1.5rem' }}>
              <h3>プロジェクト情報</h3>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>ステータス:</strong> {renderStatusBadge(selectedProject.status)}
              </p>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>期間:</strong> {selectedProject.start_date || '未設定'} 〜 {selectedProject.end_date || '未設定'}
              </p>
              <p style={{ margin: '0.5rem 0' }}>
                <strong>説明:</strong> {selectedProject.description || '説明はありません。'}
              </p>
            </div>
 
            {/* Progress & Metrics Card */}
            <div className="card shadow-subtle" style={{ padding: '1.5rem' }}>
              <h3>進捗・工数状況</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span><strong>タスク進捗率:</strong> {selectedProject.progress_rate}%</span>
                  <span>({selectedProject.completed_tasks_count} / {selectedProject.total_tasks_count} タスク)</span>
                </div>
                <div className="progress-bar-bg" style={{ height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div className="progress-bar-fill" style={{ width: `${selectedProject.progress_rate}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                </div>
              </div>
 
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span><strong>工数消化率:</strong> {selectedProject.budget_hours ? `${selectedProject.actual_hours_sum}h / ${selectedProject.budget_hours}h (予算)` : `${selectedProject.actual_hours_sum}h (予算未設定)`}</span>
                  {selectedProject.budget_hours && selectedProject.actual_hours_sum > selectedProject.budget_hours && (
                    <span className="badge badge-warning" style={{ backgroundColor: '#ef4444', color: 'white' }}>予算超過</span>
                  )}
                </div>
                {selectedProject.budget_hours ? (
                  <div className="progress-bar-bg" style={{ height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${Math.min(100, (selectedProject.actual_hours_sum / selectedProject.budget_hours) * 100)}%`, 
                        height: '100%', 
                        backgroundColor: selectedProject.actual_hours_sum > selectedProject.budget_hours ? '#ef4444' : '#10b981' 
                      }} 
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Grid Card List View
        <div>
          <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <h2>プロジェクト管理</h2>
              <select className="form-select form-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">すべてのステータス</option>
                <option value="planned">未着手</option>
                <option value="active">進行中</option>
                <option value="completed">完了</option>
                <option value="suspended">保留</option>
              </select>
            </div>
            {isAdmin && (
              <button className="btn btn-primary" onClick={handleOpenAddModal}>
                + 新規プロジェクト追加
              </button>
            )}
          </div>
 
          {loadingProjects ? (
            <div className="loading-spinner-container" style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p>プロジェクトデータを読み込み中...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="empty-state-card" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border-color)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-muted)' }}>プロジェクトが見つかりません。新規作成して進行管理を始めましょう！</p>
            </div>
          ) : (
            <div className="grid grid-3" style={{ gap: '1.5rem' }}>
              {projects.map((project) => {
                const isOverBudget = project.budget_hours && project.actual_hours_sum > project.budget_hours;
                return (
                  <div 
                    key={project.id} 
                    className="card shadow-subtle hover-lift-effect" 
                    onClick={() => setSelectedProject(project)}
                    style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                        <h4 style={{ margin: 0 }}>{project.name}</h4>
                        {renderStatusBadge(project.status)}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        期間: {project.start_date || '未設定'} 〜 {project.end_date || '未設定'}
                      </p>
                      
                      {/* Mini Progress */}
                      <div style={{ marginBottom: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                          <span>進捗率: {project.progress_rate}%</span>
                          <span>({project.completed_tasks_count}/{project.total_tasks_count})</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${project.progress_rate}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                        </div>
                      </div>
 
                      {/* Mini Budget Hours */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                          <span>工数: {project.actual_hours_sum}h {project.budget_hours ? `/ ${project.budget_hours}h` : ''}</span>
                          {isOverBudget && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>超過</span>}
                        </div>
                      </div>
                    </div>
 
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedProject(project); }}>
                        詳細
                      </button>
                      {isAdmin && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={(e) => handleOpenEditModal(project, e)}>
                            編集
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(project, e)}>
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
 
      {/* ADD MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>新規プロジェクト作成</h3>
            <form onSubmit={handleAddSubmit}>
              <Input
                id="projName"
                label="プロジェクト名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="現場Aビル新築工事 など"
                required
                containerClassName="form-group"
              />
              <TextArea
                id="projDesc"
                label="詳細説明"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="プロジェクトの概要や特記事項を入力してください"
                containerClassName="form-group"
              />
              <div className="grid grid-2" style={{ gap: '1rem' }}>
                <Input
                  id="projStart"
                  type="date"
                  label="開始予定日"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  containerClassName="form-group"
                />
                <Input
                  id="projEnd"
                  type="date"
                  label="終了予定日"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  containerClassName="form-group"
                />
              </div>
              <Input
                id="projHours"
                type="number"
                label="想定（予算）工数 (時間)"
                value={budgetHours}
                onChange={(e) => setBudgetHours(e.target.value)}
                placeholder="例: 200"
                containerClassName="form-group"
              />
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? '作成中...' : 'プロジェクト作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>プロジェクト情報を編集</h3>
            <form onSubmit={handleEditSubmit}>
              <Input
                id="editProjName"
                label="プロジェクト名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                containerClassName="form-group"
              />
              <TextArea
                id="editProjDesc"
                label="詳細説明"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                containerClassName="form-group"
              />
              <div className="form-group">
                <label className="form-label">ステータス</label>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="planned">未着手</option>
                  <option value="active">進行中</option>
                  <option value="completed">完了</option>
                  <option value="suspended">保留</option>
                </select>
              </div>
              <div className="grid grid-2" style={{ gap: '1rem' }}>
                <Input
                  id="editProjStart"
                  type="date"
                  label="開始予定日"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  containerClassName="form-group"
                />
                <Input
                  id="editProjEnd"
                  type="date"
                  label="終了予定日"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  containerClassName="form-group"
                />
              </div>
              <Input
                id="editProjHours"
                type="number"
                label="想定（予算）工数 (時間)"
                value={budgetHours}
                onChange={(e) => setBudgetHours(e.target.value)}
                containerClassName="form-group"
              />
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? '保存中...' : '変更を保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
