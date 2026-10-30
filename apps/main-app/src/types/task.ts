export interface TaskRepeatRule {
  id?: number;
  pattern: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'first_day_of_month' | 'last_day_of_month';
  details: any;
  non_working_day_behavior: 'as_is' | 'next_working_day' | 'prev_working_day' | 'skip';
}

export interface TaskComment {
  id?: number;
  task_id: number;
  user_id?: number;
  user?: {
    id: number;
    login_id: string;
  };
  content: string;
  importance: 'low' | 'medium' | 'high';
  type: 'communication' | 'handover' | 'log' | 'memo';
  related_task_id: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: number;
  organization_id: number;
  project_id: number | null;
  name: string;
  description: string | null;
  assignee_id: number | null;
  assignee?: {
    id: number;
    login_id: string;
  } | null;
  status: 'todo' | 'doing' | 'done';
  due_date: string | null;
  planned_hours: number | null;
  actual_hours: number | null;
  repeat_rule: TaskRepeatRule | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarHoliday {
  id: number;
  organization_id: number;
  holiday_date: string;
  name: string;
}
