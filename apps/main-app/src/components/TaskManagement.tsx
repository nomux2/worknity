import React, { useState, useEffect, useCallback } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import type { Task, TaskComment } from '../types/task';
import { CommentCleanupModal } from './CommentCleanupModal';
import { Input } from './ui/Input';
import { TextArea } from './ui/TextArea';
import { Select } from './ui/Select';
import { Combobox } from './ui/Combobox';
 
interface TaskManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  isAdmin: boolean;
  currentUser: {
    id: number;
    login_id: string;
    organization_id: number;
  };
}
 
interface Member {
  id: number;
  login_id: string;
  email: string;
}
 
export const TaskManagement: React.FC<TaskManagementProps> = ({ addToast, isAdmin, currentUser }) => {
  const {
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
    fetchHolidays,
  } = useTasks(addToast);
 
  const { projects, fetchProjects } = useProjects(addToast);
  const { fetchWithAuth } = useAuth();
 
  // UI states
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');
  const [filterProjectId, setFilterProjectId] = useState<string>(''); // empty means all
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Modals visibility
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showCleanupModal, setShowCleanupModal] = useState<boolean>(false);
 
  // Organization configuration (Mocked working days, fetched holidays)
  const [workingDaysStr, setWorkingDaysStr] = useState<string>('1,2,3,4,5'); // Mon-Fri
  const [members, setMembers] = useState<Member[]>([]);
 
  // Calendar states
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1); // 1-indexed
 
  // Form fields
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigneeText, setAssigneeText] = useState<string>('');

  useEffect(() => {
    if (assigneeId) {
      const member = members.find(m => String(m.id) === assigneeId);
      setAssigneeText(member ? `${member.login_id} (${member.email})` : '');
    } else {
      setAssigneeText('');
    }
  }, [assigneeId, members]);

  const handleAssigneeChange = (val: string) => {
    setAssigneeText(val);
    const matched = members.find(m => `${m.login_id} (${m.email})` === val);
    if (matched) {
      setAssigneeId(String(matched.id));
    } else if (val === '' || val === '未定') {
      setAssigneeId('');
    } else {
      setAssigneeId('');
    }
  };

  const handleAssigneeSelect = (option: { value: string; label: string }) => {
    setAssigneeId(option.value);
    setAssigneeText(option.label);
  };

  const [dueDate, setDueDate] = useState<string>('');
  const [plannedHours, setPlannedHours] = useState<string>('');
  const [actualHours, setActualHours] = useState<string>('');
  const [status, setStatus] = useState<string>('todo');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [repeatPattern, setRepeatPattern] = useState<string>('daily');
  const [repeatDays, setRepeatDays] = useState<number[]>([]); // days of week
  const [repeatNonWorking, setRepeatNonWorking] = useState<string>('skip');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
 
  // Task comment form
  const [commentContent, setCommentContent] = useState<string>('');
  const [commentImportance, setCommentImportance] = useState<string>('medium');
  const [commentType, setCommentType] = useState<string>('communication');
  const [commentRelatedTaskId, setCommentRelatedTaskId] = useState<string>('');
 
  // Initial load
  useEffect(() => {
    fetchTasks(filterProjectId ? Number(filterProjectId) : undefined, filterStatus);
    fetchProjects();
    fetchHolidays();
 
    // Fetch organization settings (working days)
    const fetchOrgSettings = async () => {
      try {
        const res = await fetchWithAuth('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          // Ideally fetch details of organization, fallback to default
          setWorkingDaysStr(data.working_days || '1,2,3,4,5');
        }
      } catch (e) {
        console.error(e);
      }
    };
 
    // Fetch members
    const fetchMembers = async () => {
      try {
        const res = await fetchWithAuth('/api/users');
        if (res.ok) {
          const data = await res.json();
          setMembers(data || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
 
    fetchOrgSettings();
    fetchMembers();
  }, [filterProjectId, filterStatus, fetchTasks, fetchProjects, fetchHolidays, fetchWithAuth]);
 
  // Fetch comments when task is selected
  useEffect(() => {
    if (selectedTask) {
      fetchComments(selectedTask.id);
    }
  }, [selectedTask, fetchComments]);
 
  // Dynamic repeat days checkbox handler
  const handleRepeatDayToggle = (day: number) => {
    setRepeatDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };
 
  const handleOpenAddModal = () => {
    setName('');
    setDescription('');
    setProjectId('');
    setAssigneeId('');
    setDueDate('');
    setPlannedHours('');
    setIsRecurring(false);
    setRepeatPattern('daily');
    setRepeatDays([]);
    setRepeatNonWorking('skip');
    setShowAddModal(true);
  };
 
  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
 
    const success = await createTask({
      project_id: projectId ? Number(projectId) : null,
      name,
      description: description || undefined,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      status: 'todo',
      due_date: dueDate || undefined,
      planned_hours: plannedHours ? Number(plannedHours) : undefined,
      repeat_rule: isRecurring ? {
        pattern: repeatPattern,
        details: repeatDays.length > 0 ? { days_of_week: repeatDays } : null,
        non_working_day_behavior: repeatNonWorking,
      } : null,
    });
 
    setIsSubmitting(false);
    if (success) {
      setShowAddModal(false);
      fetchTasks(filterProjectId ? Number(filterProjectId) : undefined, filterStatus);
    }
  };
 
  const handleUpdateTaskStatus = async (task: Task, newStatus: 'todo' | 'doing' | 'done') => {
    // Optimistic UI updates
    const prevTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
 
    const success = await updateTask(task.id, { status: newStatus });
    if (!success) {
      // Rollback
      setTasks(prevTasks);
      addToast('ステータスの更新に失敗しました。', 'error');
    } else {
      fetchTasks(filterProjectId ? Number(filterProjectId) : undefined, filterStatus);
    }
  };
 
  const handleTaskDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
 
    const success = await updateTask(selectedTask.id, {
      project_id: projectId ? Number(projectId) : null,
      name: isAdmin ? name : undefined,
      description: isAdmin ? description : undefined,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      status: status || undefined,
      due_date: isAdmin && dueDate ? dueDate : undefined,
      planned_hours: isAdmin && plannedHours ? Number(plannedHours) : undefined,
      actual_hours: actualHours ? Number(actualHours) : undefined,
      repeat_rule: isAdmin && isRecurring ? {
        pattern: repeatPattern,
        details: repeatDays.length > 0 ? { days_of_week: repeatDays } : null,
        non_working_day_behavior: repeatNonWorking,
      } : null,
    });
 
    setIsSubmitting(false);
    if (success) {
      fetchTasks(filterProjectId ? Number(filterProjectId) : undefined, filterStatus);
      // Reload detailed view
      setSelectedTask(null);
    }
  };
 
  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm(`タスク「${task.name}」を削除しますか？`)) {
      return;
    }
 
    const success = await deleteTask(task.id);
    if (success) {
      setSelectedTask(null);
      fetchTasks(filterProjectId ? Number(filterProjectId) : undefined, filterStatus);
    }
  };
 
  const handlePostCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentContent.trim()) return;
 
    // Optimistic UI Comment insert
    const tempComment: TaskComment = {
      task_id: selectedTask.id,
      content: commentContent,
      importance: commentImportance as any,
      type: commentType as any,
      related_task_id: commentRelatedTaskId ? Number(commentRelatedTaskId) : null,
      user: {
        id: currentUser.id,
        login_id: currentUser.login_id
      },
      created_at: new Date().toISOString()
    };
 
    setComments(prev => [...prev, tempComment]);
    setCommentContent('');
 
    const success = await postComment(selectedTask.id, {
      content: tempComment.content,
      importance: tempComment.importance,
      type: tempComment.type,
      related_task_id: tempComment.related_task_id,
    });
 
    if (!success) {
      // Rollback
      setComments(prev => prev.filter(c => c !== tempComment));
    }
  };
 
  const handleCleanupConfirm = async (data: { before_days: number; types: string[]; importances: string[] }) => {
    const success = await cleanupComments(data);
    if (success && selectedTask) {
      fetchComments(selectedTask.id);
    }
  };
 
  // Dynamic open detail click
  const handleOpenDetail = (task: Task) => {
    setName(task.name);
    setDescription(task.description || '');
    setProjectId(task.project_id ? String(task.project_id) : '');
    setAssigneeId(task.assignee_id ? String(task.assignee_id) : '');
    setDueDate(task.due_date || '');
    setPlannedHours(task.planned_hours ? String(task.planned_hours) : '');
    setActualHours(task.actual_hours ? String(task.actual_hours) : '');
    setIsRecurring(!!task.repeat_rule);
    if (task.repeat_rule) {
      setRepeatPattern(task.repeat_rule.pattern);
      setRepeatDays(task.repeat_rule.details?.days_of_week || []);
      setRepeatNonWorking(task.repeat_rule.non_working_day_behavior);
    }
    setCommentContent('');
    setCommentImportance('medium');
    setCommentType('communication');
    setCommentRelatedTaskId('');
    setSelectedTask(task);
  };
 
  // --- VIRTUAL MAPPING CALENDAR LOGIC ---
  const getMappedTaskInstances = useCallback(() => {
    const instances: { task: Task; dateStr: string }[] = [];
    const workingDays = workingDaysStr.split(',').map(Number);
    const holidaySet = new Set(holidays.map(h => h.holiday_date));
 
    const isWorking = (d: Date) => {
      const ymd = d.toISOString().split('T')[0];
      const dow = d.getDay();
      const dbDow = dow === 0 ? 7 : dow;
      return workingDays.includes(dbDow) && !holidaySet.has(ymd);
    };
 
    const getNextWorking = (d: Date) => {
      const next = new Date(d);
      do {
        next.setDate(next.getDate() + 1);
      } while (!isWorking(next));
      return next;
    };
 
    const getPrevWorking = (d: Date) => {
      const prev = new Date(d);
      do {
        prev.setDate(prev.getDate() - 1);
      } while (!isWorking(prev));
      return prev;
    };
 
    // Scan buffer around current month to catch shifts
    const scanStart = new Date(currentYear, currentMonth - 1, -15);
    const scanEnd = new Date(currentYear, currentMonth, 15);
 
    tasks.forEach(task => {
      if (!task.repeat_rule) {
        if (task.due_date) {
          instances.push({ task, dateStr: task.due_date });
        }
        return;
      }
 
      const repeat = task.repeat_rule;
      const taskCreatedStr = task.created_at.split(' ')[0];
      const taskCreated = new Date(taskCreatedStr);
      let scanDate = new Date(scanStart > taskCreated ? scanStart : taskCreated);
 
      while (scanDate <= scanEnd) {
        const scanYmd = scanDate.toISOString().split('T')[0];
        if (task.due_date && scanYmd > task.due_date) {
          break;
        }
 
        let isPatternHit = false;
        const dow = scanDate.getDay();
        const dbDow = dow === 0 ? 7 : dow;
 
        if (repeat.pattern === 'daily') {
          isPatternHit = true;
        } else if (repeat.pattern === 'weekly') {
          const days = repeat.details?.days_of_week || [];
          isPatternHit = days.includes(dbDow);
        } else if (repeat.pattern === 'biweekly') {
          const diffWeeks = Math.floor((scanDate.getTime() - taskCreated.getTime()) / (7 * 24 * 60 * 60 * 1000));
          const days = repeat.details?.days_of_week || [];
          isPatternHit = (diffWeeks % 2 === 0) && days.includes(dbDow);
        } else if (repeat.pattern === 'monthly') {
          isPatternHit = scanDate.getDate() === (repeat.details?.day_of_month || 1);
        } else if (repeat.pattern === 'first_day_of_month') {
          isPatternHit = scanDate.getDate() === 1;
        } else if (repeat.pattern === 'last_day_of_month') {
          const tomorrow = new Date(scanDate);
          tomorrow.setDate(scanDate.getDate() + 1);
          isPatternHit = tomorrow.getDate() === 1;
        }
 
        if (isPatternHit) {
          const isTodayWorking = isWorking(scanDate);
          if (isTodayWorking || repeat.non_working_day_behavior === 'as_is') {
            instances.push({ task, dateStr: scanYmd });
          } else if (repeat.non_working_day_behavior === 'next_working_day') {
            const nextW = getNextWorking(scanDate);
            instances.push({ task, dateStr: nextW.toISOString().split('T')[0] });
          } else if (repeat.non_working_day_behavior === 'prev_working_day') {
            const prevW = getPrevWorking(scanDate);
            instances.push({ task, dateStr: prevW.toISOString().split('T')[0] });
          }
        }
 
        scanDate.setDate(scanDate.getDate() + 1);
      }
    });
 
    return instances;
  }, [tasks, workingDaysStr, holidays, currentYear, currentMonth]);
 
  // Generate calendar grid days for render
  const generateCalendarDays = () => {
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);
    const daysInMonth = endOfMonth.getDate();
    
    // Find offset days for start of week (Sunday is 0, let's align to Monday-based or Sunday-based grid. Standard is Sunday offset)
    const startOffset = startOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
    
    const days: (Date | null)[] = [];
    
    // Offsets
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    
    // Real days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth - 1, day));
    }
 
    return days;
  };
 
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };
 
  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };
 
  // Render helpers
  const mappedInstances = getMappedTaskInstances();
  const calendarDays = generateCalendarDays();
 
  return (
    <div className="tab-pane-container">
      {/* HEADER SECTION */}
      <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2>タスク管理</h2>
          
          {/* Project dropdown */}
          <Select
            size="sm"
            containerStyle={{ width: '220px' }}
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            options={[
              { value: '', label: 'すべてのプロジェクト' },
              { value: '0', label: 'プロジェクトなし（日常ルーティン）' },
              ...projects.map(p => ({ value: String(p.id), label: p.name }))
            ]}
          />

          {/* Status dropdown */}
          <Select
            size="sm"
            containerStyle={{ width: '150px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: '', label: 'すべての状況' },
              { value: 'todo', label: '未着手' },
              { value: 'doing', label: '進行中' },
              { value: 'done', label: '完了' }
            ]}
          />
 
          {/* View mode switcher */}
          <div className="btn-group">
            <button className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('kanban')}>
              カンバン
            </button>
            <button className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('calendar')}>
              カレンダー
            </button>
          </div>
        </div>
 
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowCleanupModal(true)}>
                クリーンアップ
              </button>
              <button className="btn btn-primary" onClick={handleOpenAddModal}>
                + タスク追加
              </button>
            </>
          )}
        </div>
      </div>
 
      {loadingTasks ? (
        <div className="loading-spinner-container" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p>タスクデータを読み込み中...</p>
        </div>
      ) : viewMode === 'kanban' ? (
        // ---------------- KANBAN VIEW ----------------
        <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', minHeight: '500px' }}>
          {/* Lane TODO */}
          <div className="kanban-lane" style={{ backgroundColor: 'var(--card-bg-secondary, #f8f9fa)', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>未着手 (todo)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {tasks.filter(t => t.status === 'todo').map(task => (
                <div key={task.id} className="card shadow-subtle hover-lift-effect" onClick={() => handleOpenDetail(task)} style={{ padding: '1rem', cursor: 'pointer' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {task.project_id ? (projects.find(p => p.id === task.project_id)?.name || 'プロジェクト') : '日常ルーティン'}
                  </div>
                  <h5 style={{ margin: '0 0 0.5rem 0' }}>{task.name}</h5>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>担当: {task.assignee?.login_id || '未定'}</span>
                    <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(task, 'doing'); }}>
                      開始 &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
 
          {/* Lane DOING */}
          <div className="kanban-lane" style={{ backgroundColor: 'var(--card-bg-secondary, #f8f9fa)', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>進行中 (doing)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {tasks.filter(t => t.status === 'doing').map(task => (
                <div key={task.id} className="card shadow-subtle hover-lift-effect" onClick={() => handleOpenDetail(task)} style={{ padding: '1rem', cursor: 'pointer' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {task.project_id ? (projects.find(p => p.id === task.project_id)?.name || 'プロジェクト') : '日常ルーティン'}
                  </div>
                  <h5 style={{ margin: '0 0 0.5rem 0' }}>{task.name}</h5>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>担当: {task.assignee?.login_id || '未定'}</span>
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(task, 'done'); }}>
                      完了 &check;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
 
          {/* Lane DONE */}
          <div className="kanban-lane" style={{ backgroundColor: 'var(--card-bg-secondary, #f8f9fa)', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>完了 (done)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {tasks.filter(t => t.status === 'done').map(task => (
                <div key={task.id} className="card shadow-subtle hover-lift-effect" onClick={() => handleOpenDetail(task)} style={{ padding: '1rem', cursor: 'pointer', opacity: 0.7 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    {task.project_id ? (projects.find(p => p.id === task.project_id)?.name || 'プロジェクト') : '日常ルーティン'}
                  </div>
                  <h5 style={{ margin: '0 0 0.5rem 0', textDecoration: 'line-through' }}>{task.name}</h5>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>担当: {task.assignee?.login_id || '未定'}</span>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(task, 'todo'); }}>
                      戻す
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ---------------- CALENDAR VIEW ----------------
        <div className="calendar-container">
          {/* Month selector */}
          <div className="calendar-month-selector" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrevMonth}>&larr; 前月</button>
            <h3 style={{ margin: 0 }}>{currentYear}年 {currentMonth}月</h3>
            <button className="btn btn-secondary btn-sm" onClick={handleNextMonth}>次月 &rarr;</button>
          </div>
 
          {/* Days labels */}
          <div className="calendar-grid-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontWeight: 'bold', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <div style={{ color: '#ef4444' }}>日</div>
            <div>月</div>
            <div>火</div>
            <div>水</div>
            <div>木</div>
            <div>金</div>
            <div style={{ color: 'var(--color-primary)' }}>土</div>
          </div>
 
          {/* Grid */}
          <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', backgroundColor: 'var(--border-color)', padding: '2px', borderRadius: '4px' }}>
            {calendarDays.map((date, idx) => {
              if (date === null) {
                return <div key={`empty-${idx}`} className="calendar-cell empty" style={{ backgroundColor: 'var(--card-bg-secondary, #f8f9fa)', minHeight: '100px' }} />;
              }
 
              const dateYmd = date.toISOString().split('T')[0];
              const dateNumber = date.getDate();
              const isToday = new Date().toDateString() === date.toDateString();
 
              // Get tasks mapped to this date
              const tasksForDay = mappedInstances.filter(inst => inst.dateStr === dateYmd);
 
              return (
                <div 
                  key={dateYmd} 
                  className={`calendar-cell ${isToday ? 'today' : ''}`} 
                  style={{ 
                    backgroundColor: isToday ? 'rgba(var(--color-primary-rgb), 0.05)' : 'var(--card-bg, #ffffff)', 
                    minHeight: '120px', 
                    padding: '0.3rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: isToday ? 'bold' : 'normal' }}>
                    <span style={{ color: date.getDay() === 0 ? '#ef4444' : date.getDay() === 6 ? 'var(--color-primary)' : 'inherit' }}>
                      {dateNumber}
                    </span>
                    {isToday && <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)' }}>今日</span>}
                  </div>
 
                  <div className="calendar-cell-tasks" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem', overflow: 'hidden', flexGrow: 1 }}>
                    {tasksForDay.slice(0, 3).map(inst => {
                      let statusStyle = { borderLeft: '3px solid #6b7280' }; // todo (gray)
                      if (inst.task.status === 'doing') statusStyle = { borderLeft: '3px solid var(--color-primary)' };
                      if (inst.task.status === 'done') statusStyle = { borderLeft: '3px solid #10b981', textDecoration: 'line-through', opacity: 0.6 } as any;
 
                      return (
                        <div 
                          key={`${inst.task.id}-${inst.dateStr}`} 
                          className="calendar-task-badge"
                          onClick={() => handleOpenDetail(inst.task)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 4px',
                            backgroundColor: 'var(--card-bg-secondary, #f3f4f6)',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            ...statusStyle
                          }}
                          title={inst.task.name}
                        >
                          {inst.task.name}
                        </div>
                      );
                    })}
                    {tasksForDay.length > 3 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                        他 {tasksForDay.length - 3} 件
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
 
      {/* ---------------- ADD TASK MODAL ---------------- */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>新規タスク登録</h3>
            <form onSubmit={handleAddTaskSubmit}>
              <Input
                id="taskName"
                label="タスク名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="エアコンのフィルター清掃 など"
                required
                containerClassName="form-group"
              />
              <TextArea
                id="taskDesc"
                label="詳細説明"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="手順や注意事項を入力してください"
                containerClassName="form-group"
              />
              <Select
                label="関連プロジェクト"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                containerClassName="form-group"
                options={[
                  { value: '', label: '日常ルーティン（プロジェクトなし）' },
                  ...projects.map(p => ({ value: p.id, label: p.name }))
                ]}
              />

              <Combobox
                label="担当者"
                value={assigneeText}
                onChange={handleAssigneeChange}
                onSelectOption={handleAssigneeSelect}
                containerClassName="form-group"
                options={[
                  { value: '', label: '未定' },
                  ...members.map(m => ({ value: String(m.id), label: `${m.login_id} (${m.email})` }))
                ]}
                placeholder="担当者を入力・選択してください"
              />

 
              <div className="grid grid-2" style={{ gap: '1rem' }}>
                <Input
                  id="taskDue"
                  type="date"
                  label="期限日 / 開始日"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  containerClassName="form-group"
                />
                <Input
                  id="taskPlanned"
                  type="number"
                  step="0.5"
                  label="予定工数 (時間)"
                  value={plannedHours}
                  onChange={(e) => setPlannedHours(e.target.value)}
                  placeholder="例: 1.5"
                  containerClassName="form-group"
                />
              </div>
 
              {/* REPEAT RULE SECTION */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1rem', marginTop: '1rem', backgroundColor: 'var(--card-bg-secondary)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                  繰り返し（ルーティン）タスクに設定する
                </label>
 
                {isRecurring && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <Select
                      label="繰り返しパターン"
                      value={repeatPattern}
                      onChange={(e) => setRepeatPattern(e.target.value)}
                      options={[
                        { value: 'daily', label: '毎日' },
                        { value: 'weekly', label: '毎週' },
                        { value: 'biweekly', label: '隔週' },
                        { value: 'monthly', label: '毎月' },
                        { value: 'first_day_of_month', label: '月初 (1日)' },
                        { value: 'last_day_of_month', label: '月末' }
                      ]}
                    />
 
                    {(repeatPattern === 'weekly' || repeatPattern === 'biweekly') && (
                      <div className="form-group">
                        <label className="form-label">曜日選択</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                          {['月', '火', '水', '木', '金', '土', '日'].map((day, idx) => {
                            const val = idx + 1;
                            return (
                              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input
                                  type="checkbox"
                                  checked={repeatDays.includes(val)}
                                  onChange={() => handleRepeatDayToggle(val)}
                                />
                                {day}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
 
                    <Select
                      label="非稼働日（休日）と重なった場合"
                      value={repeatNonWorking}
                      onChange={(e) => setRepeatNonWorking(e.target.value)}
                      options={[
                        { value: 'skip', label: 'スキップ（生成しない）' },
                        { value: 'as_is', label: 'そのまま生成' },
                        { value: 'next_working_day', label: '翌稼働日にシフト' },
                        { value: 'prev_working_day', label: '前稼働日にシフト' }
                      ]}
                    />
                  </div>
                )}
              </div>
 
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>キャンセル</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? '登録中...' : 'タスク登録'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* ---------------- DETAIL / EDIT / COMMENT MODAL ---------------- */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%' }}>
            
            {/* Modal Columns */}
            <div className="grid grid-2" style={{ gap: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}>
              
              {/* Left Column: Edit Form */}
              <div>
                <h3>タスク詳細</h3>
                <form onSubmit={handleTaskDetailsSubmit}>
                  <Input
                    id="editName"
                    label="タスク名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isAdmin}
                    required
                    containerClassName="form-group"
                  />
                  <TextArea
                    id="editDesc"
                    label="詳細説明"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isAdmin}
                    containerClassName="form-group"
                  />
                  
                  <Select
                    label="ステータス"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    containerClassName="form-group"
                    options={[
                      { value: 'todo', label: '未着手 (todo)' },
                      { value: 'doing', label: '進行中 (doing)' },
                      { value: 'done', label: '完了 (done)' }
                    ]}
                  />

                  <Combobox
                    label="担当者"
                    value={assigneeText}
                    onChange={handleAssigneeChange}
                    onSelectOption={handleAssigneeSelect}
                    containerClassName="form-group"
                    options={[
                      { value: '', label: '未定' },
                      ...members.map(m => ({ value: String(m.id), label: `${m.login_id} (${m.email})` }))
                    ]}
                    placeholder="担当者を入力・選択してください"
                    disabled={!isAdmin}
                  />

 
                  <div className="grid grid-2" style={{ gap: '1rem' }}>
                    <Input
                      id="editDue"
                      type="date"
                      label="期限日"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={!isAdmin}
                      containerClassName="form-group"
                    />
                    <Input
                      id="editPlanned"
                      type="number"
                      step="0.5"
                      label="予定工数 (時間)"
                      value={plannedHours}
                      onChange={(e) => setPlannedHours(e.target.value)}
                      disabled={!isAdmin}
                      containerClassName="form-group"
                    />
                  </div>
 
                  <Input
                    id="editActual"
                    type="number"
                    step="0.1"
                    label="実績工数 (時間)"
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value)}
                    containerClassName="form-group"
                  />
 
                  <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? '保存中...' : '変更を保存'}
                    </button>
                    {isAdmin && (
                      <button type="button" className="btn btn-danger" onClick={() => handleDeleteTask(selectedTask)}>
                        タスク削除
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedTask(null)}>閉じる</button>
                  </div>
                </form>
              </div>
 
              {/* Right Column: Comments Area */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4>申し送り・コメント</h4>
                
                {/* Comments List */}
                <div style={{ flexGrow: 1, maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', backgroundColor: 'var(--card-bg-secondary)' }}>
                  {loadingComments ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>コメントを読み込み中...</div>
                  ) : comments.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>コメントはありません。</div>
                  ) : (
                    comments.map((c, cIdx) => {
                      const typeLabel = c.type === 'handover' ? '申し送り' : c.type === 'log' ? 'ログ' : c.type === 'memo' ? 'メモ' : '連絡';
                      const typeColor = c.type === 'handover' ? '#f59e0b' : c.type === 'log' ? 'var(--color-primary)' : 'var(--text-muted)';
                      
                      return (
                        <div key={c.id || cIdx} style={{ backgroundColor: 'var(--card-bg, #fff)', padding: '0.6rem', borderRadius: '4px', borderLeft: `4px solid ${typeColor}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            <span>{c.user?.login_id} ({typeLabel})</span>
                            <span>{c.importance === 'high' ? '重要' : ''}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{c.content}</p>
                        </div>
                      );
                    })
                  )}
                </div>
 
                {/* Post New Comment */}
                <form onSubmit={handlePostCommentSubmit} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div className="grid grid-2" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Select
                      size="sm"
                      value={commentType}
                      onChange={(e) => setCommentType(e.target.value)}
                      options={[
                        { value: 'communication', label: '連絡' },
                        { value: 'handover', label: '申し送り' },
                        { value: 'log', label: '作業ログ' },
                        { value: 'memo', label: 'メモ' }
                      ]}
                    />
                    <Select
                      size="sm"
                      value={commentImportance}
                      onChange={(e) => setCommentImportance(e.target.value)}
                      options={[
                        { value: 'low', label: '重要度: 低' },
                        { value: 'medium', label: '重要度: 中' },
                        { value: 'high', label: '重要度: 高' }
                      ]}
                    />
                  </div>
 
                  <div style={{ marginBottom: '0.5rem' }}>
                    <Select
                      size="sm"
                      value={commentRelatedTaskId}
                      onChange={(e) => setCommentRelatedTaskId(e.target.value)}
                      options={[
                        { value: '', label: '関連タスク: なし' },
                        ...tasks.filter(t => t.id !== selectedTask?.id).map(t => ({
                          value: String(t.id),
                          label: t.name
                        }))
                      ]}
                    />
                  </div>

                  <TextArea
                    id="newComment"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="作業進捗や連絡事項、引き継ぎを入力してください"
                    rows={3}
                    required
                    containerClassName="form-group"
                  />
                  <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                    コメント投稿
                  </button>
                </form>
              </div>
 
            </div>
          </div>
        </div>
      )}
 
      {/* ---------------- CLEANUP MODAL ---------------- */}
      <CommentCleanupModal
        isOpen={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        onConfirm={handleCleanupConfirm}
      />
    </div>
  );
};
