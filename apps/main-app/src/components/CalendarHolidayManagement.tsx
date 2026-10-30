import React, { useEffect, useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { Input } from './ui/Input';

interface CalendarHolidayManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const CalendarHolidayManagement: React.FC<CalendarHolidayManagementProps> = ({ addToast }) => {
  const {
    holidays,
    loadingHolidays,
    fetchHolidays,
    createHoliday,
    deleteHoliday,
    workingDays,
    updateWorkingDays,
  } = useTasks(addToast);

  // Form states
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayName, setNewHolidayName] = useState<string>('');
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState<boolean>(false);
  const [isSubmittingWorkingDays, setIsSubmittingWorkingDays] = useState<boolean>(false);

  // Local state for checkboxes matching workingDays string
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  // Sync checkboxes whenever workingDays string changes from backend
  useEffect(() => {
    if (workingDays) {
      const days = workingDays.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 7);
      setSelectedDays(days);
    }
  }, [workingDays]);

  const handleDayCheckboxChange = (dayNum: number, checked: boolean) => {
    if (checked) {
      setSelectedDays(prev => [...prev, dayNum].sort());
    } else {
      setSelectedDays(prev => prev.filter(d => d !== dayNum));
    }
  };

  const handleWorkingDaysSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDays.length === 0) {
      addToast('少なくとも1日は稼働曜日を設定してください。', 'warning');
      return;
    }
    setIsSubmittingWorkingDays(true);
    await updateWorkingDays(selectedDays.join(','));
    setIsSubmittingWorkingDays(false);
  };

  const handleAddHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) return;

    setIsSubmittingHoliday(true);
    const success = await createHoliday(newHolidayDate, newHolidayName.trim());
    setIsSubmittingHoliday(false);

    if (success) {
      setNewHolidayDate('');
      setNewHolidayName('');
    }
  };

  const handleDeleteHoliday = async (id: number, name: string) => {
    if (!window.confirm(`休日「${name}」の設定を削除しますか？`)) {
      return;
    }
    await deleteHoliday(id);
  };

  const weekDayLabels = [
    { num: 1, label: '月曜日' },
    { num: 2, label: '火曜日' },
    { num: 3, label: '水曜日' },
    { num: 4, label: '木曜日' },
    { num: 5, label: '金曜日' },
    { num: 6, label: '土曜日' },
    { num: 7, label: '日曜日' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
      
      {/* 1. Working Days Setting Card */}
      <div className="section-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>組織の稼働曜日設定</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            繰り返しタスクが非稼働日に重なった際の自動前倒し・後ろ倒し判定に使用されます。
          </p>
        </div>

        <form onSubmit={handleWorkingDaysSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem', padding: '0.5rem 0' }}>
            {weekDayLabels.map(day => {
              const isChecked = selectedDays.includes(day.num);
              return (
                <label
                  key={day.num}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--border-radius-sm)',
                    backgroundColor: isChecked ? 'var(--primary-light)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: isChecked ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover-card"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleDayCheckboxChange(day.num, e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>{day.label}</span>
                </label>
              );
            })}
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={isSubmittingWorkingDays}>
              {isSubmittingWorkingDays ? '保存中...' : '稼働曜日を保存'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Custom Holidays Setting Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left: Register Holiday Form */}
        <div className="section-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>祝日・臨時休日の追加</h3>
          
          <form onSubmit={handleAddHolidaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              id="holiday_date"
              type="date"
              label="日付"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              required
              containerClassName="form-group"
            />
            
            <Input
              id="holiday_name"
              type="text"
              label="名称 (例: 創立記念日, 年末年始休日)"
              placeholder="名称を入力してください"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              required
              containerClassName="form-group"
            />

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmittingHoliday}>
              {isSubmittingHoliday ? '追加中...' : '休日を追加する'}
            </button>
          </form>
        </div>

        {/* Right: Holidays List */}
        <div className="section-card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>登録済みの休日一覧</h3>

          <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '300px' }}>
            {loadingHolidays ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>読み込み中...</div>
            ) : holidays.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.9rem' }}>
                登録されている休日・祝日はありません。
              </div>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>休日名</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>{h.holiday_date}</td>
                      <td style={{ fontSize: '0.9rem' }}>{h.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-text btn-xs"
                          style={{ color: 'var(--status-alert)', padding: '0.2rem 0.5rem' }}
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
      </div>

    </div>
  );
};
