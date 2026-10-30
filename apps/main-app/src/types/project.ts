export interface Project {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  status: 'planned' | 'active' | 'completed' | 'suspended';
  start_date: string | null;
  end_date: string | null;
  budget_hours: number | null;
  actual_hours_sum: number;
  total_tasks_count: number;
  completed_tasks_count: number;
  progress_rate: number;
  created_at: string;
  updated_at: string;
}
