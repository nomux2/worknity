import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AttendanceIcon } from './ui/Icons';

interface AttendanceRecord {
  id: number;
  organization_id: number;
  user_id: number;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  status: 'working' | 'completed' | 'absent' | 'leave';
  work_minutes: number;
  formatted_work_time: string;
  formatted_clock_in: string | null;
  formatted_clock_out: string | null;
  user?: {
    id: number;
    login_id: string;
  };
}

interface AttendanceRequest {
  id: number;
  organization_id: number;
  user_id: number;
  type: 'correction' | 'leave';
  status: 'pending' | 'approved' | 'rejected';
  target_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  requested_break_minutes: number | null;
  leave_type: 'paid' | 'unpaid' | 'special' | null;
  reason: string | null;
  approved_by: number | null;
  approved_at: string | null;
  user_login_id: string | null;
  approver_login_id: string | null;
  formatted_requested_clock_in: string | null;
  formatted_requested_clock_out: string | null;
  created_at?: string;
  updated_at?: string;
}

interface UserItem {
  id: number;
  email: string | null;
  login_id: string;
  role: string;
}

interface AttendanceManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ addToast }) => {
  const { user, fetchWithAuth } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State definitions
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [staffList, setStaffList] = useState<UserItem[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [submittingPunch, setSubmittingPunch] = useState<boolean>(false);
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);

  // Time & Month picker
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateString, setCurrentDateString] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Punch Status
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  // Active UI Mode
  const [mode, setMode] = useState<'clock' | 'correction' | 'leave' | 'requests'>('clock');

  // Request Form States
  const [reqType, setReqType] = useState<'correction' | 'leave'>('correction');
  const [reqTargetDate, setReqTargetDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reqClockIn, setReqClockIn] = useState<string>('09:00');
  const [reqClockOut, setReqClockOut] = useState<string>('18:00');
  const [reqBreakMinutes, setReqBreakMinutes] = useState<number>(60);
  const [reqLeaveType, setReqLeaveType] = useState<'paid' | 'unpaid' | 'special'>('paid');
  const [reqReason, setReqReason] = useState<string>('');

  // Clock effect
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const day = dayNames[now.getDay()];
      setCurrentDateString(`${y}年${m}月${d}日 (${day})`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch staff list for administrators
  const fetchStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetchWithAuth('/api/users');
      if (res.ok) {
        const data = await res.json();
        setStaffList(data);
      }
    } catch (e) {
      console.error('Failed to fetch staff list:', e);
    }
  }, [isAdmin, fetchWithAuth]);

  // Fetch attendance records
  const fetchRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      let url = `/api/attendances?month=${selectedMonth}`;
      if (isAdmin && selectedStaffId !== 'all') {
        url += `&user_id=${selectedStaffId}`;
      }
      
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const payload = await res.json();
        setRecords(payload.data || []);
        
        // Find if there is an active 'working' status for today
        const todayStr = new Date().toISOString().split('T')[0];
        const workingRec = (payload.data as AttendanceRecord[]).find(
          r => r.user_id === user?.id && r.status === 'working'
        );
        const todayRec = (payload.data as AttendanceRecord[]).find(
          r => r.user_id === user?.id && r.work_date === todayStr
        );
        setTodayRecord(workingRec || todayRec || null);
      }
    } catch (e) {
      console.error(e);
      addToast('勤怠データの読み込みに失敗しました。', 'error');
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedMonth, selectedStaffId, isAdmin, user?.id, fetchWithAuth, addToast]);

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetchWithAuth('/api/attendance-requests');
      if (res.ok) {
        const payload = await res.json();
        setRequests(payload.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRequests(false);
    }
  }, [fetchWithAuth]);

  // Initial load and updates
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords();
    fetchRequests();
    fetchStaff();
  }, [selectedMonth, selectedStaffId, fetchRecords, fetchRequests, fetchStaff]);

  // Handle Clock In
  const handleClockIn = async () => {
    setSubmittingPunch(true);
    try {
      const res = await fetchWithAuth('/api/attendances/clock-in', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || '出勤打刻を完了しました。', 'success');
        fetchRecords();
      } else {
        addToast(data.message || '出勤打刻に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('出勤打刻に失敗しました。', 'error');
    } finally {
      setSubmittingPunch(false);
    }
  };

  // Handle Clock Out
  const handleClockOut = async () => {
    setSubmittingPunch(true);
    try {
      const res = await fetchWithAuth('/api/attendances/clock-out', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || '退勤打刻を完了しました。お疲れ様でした！', 'success');
        fetchRecords();
      } else {
        addToast(data.message || '退勤打刻に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('退勤打刻に失敗しました。', 'error');
    } finally {
      setSubmittingPunch(false);
    }
  };

  // Submit Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqReason.trim()) {
      addToast('申請理由を入力してください。', 'warning');
      return;
    }
    setSubmittingRequest(true);

    const body: {
      type: 'correction' | 'leave';
      target_date: string;
      reason: string;
      requested_clock_in?: string;
      requested_clock_out?: string;
      requested_break_minutes?: number;
      leave_type?: 'paid' | 'unpaid' | 'special';
    } = {
      type: reqType,
      target_date: reqTargetDate,
      reason: reqReason,
    };

    if (reqType === 'correction') {
      body.requested_clock_in = reqClockIn;
      body.requested_clock_out = reqClockOut;
      body.requested_break_minutes = reqBreakMinutes;
    } else {
      body.leave_type = reqLeaveType;
    }

    try {
      const res = await fetchWithAuth('/api/attendance-requests', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || '申請を送信しました。', 'success');
        setReqReason('');
        fetchRequests();
      } else {
        addToast(data.message || '申請の送信に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('申請の送信中にエラーが発生しました。', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handle Approval / Rejection
  const handleRequestAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetchWithAuth(`/api/attendance-requests/${id}/${action}`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || `申請を${action === 'approve' ? '承認' : '却下'}しました。`, 'success');
        fetchRequests();
        fetchRecords();
      } else {
        addToast(data.message || '処理に失敗しました。', 'error');
      }
    } catch (e) {
      console.error(e);
      addToast('処理中にエラーが発生しました。', 'error');
    }
  };

  // CSV Export helper
  const handleExportCSV = () => {
    if (records.length === 0) {
      addToast('出力するデータがありません。', 'warning');
      return;
    }

    const headers = ['勤務日', 'スタッフ名', '出勤時刻', '退勤時刻', '休憩（分）', '労働時間', 'ステータス'];
    const rows = records.map(r => [
      r.work_date,
      r.user?.login_id || user?.login_id || '',
      r.formatted_clock_in || '',
      r.formatted_clock_out || '',
      r.break_minutes,
      r.formatted_work_time,
      r.status === 'working' ? '出勤中' : r.status === 'completed' ? '退勤済' : r.status === 'leave' ? '休暇' : '欠勤'
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `勤怠データ_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('CSVファイルのエクスポートが完了しました！');
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'working':
        return <span className="badge badge-warning">出勤中</span>;
      case 'completed':
        return <span className="badge badge-good">退勤済</span>;
      case 'leave':
        return <span className="badge badge-secondary">休暇</span>;
      case 'absent':
        return <span className="badge badge-alert">欠勤</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    return type === 'correction' ? '打刻修正' : '休暇申請';
  };

  const getRequestStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-warning">未承認</span>;
      case 'approved':
        return <span className="badge badge-good">承認済</span>;
      case 'rejected':
        return <span className="badge badge-alert">却下</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  // Filter requests for left pane list
  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '1rem' }}>
      
      {/* Top Controller Bar */}
      <div className="section-card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Header Mode Toggle Switchers */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-app)', padding: '0.25rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'clock' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setMode('clock')}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            打刻・勤務表
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'correction' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => {
              setMode('correction');
              setReqType('correction');
            }}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            打刻修正申請
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'leave' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => {
              setMode('leave');
              setReqType('leave');
            }}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            休暇申請
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'requests' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setMode('requests')}
            style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
          >
            {isAdmin ? '申請承認' : '申請履歴'}
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {/* Month selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>対象月:</span>
            <input 
              type="month" 
              className="form-control" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}
            />
          </div>

          {/* Admin staff selector */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>スタッフ:</span>
              <select
                className="form-control"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.9rem', minWidth: '130px' }}
              >
                <option value="all">全員を表示</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.login_id}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
          >
            CSVダウンロード
          </button>
        </div>
      </div>

      {/* 2-Pane Screen Layout */}
      <div className="inventory-container">
        
        {/* Left Pane (Actions & Forms) - 1/3 Width */}
        <div className="action-pane slide-in-right" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          <div className="pane-header">
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {mode === 'clock' && '今日の打刻・勤務'}
              {mode === 'correction' && '打刻修正の申請'}
              {mode === 'leave' && '休暇の申請'}
              {mode === 'requests' && (isAdmin ? '申請の承認処理' : '承認待ちの申請')}
            </h3>
          </div>

          <div className="pane-body-scrollable" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* 1. Punch Card */}
            {mode === 'clock' && (
              <div className="pane-card" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{currentDateString}</span>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-main)', letterSpacing: '0.05em' }}>
                  {currentTime}
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleClockIn}
                    disabled={submittingPunch || (todayRecord !== null && todayRecord.status !== 'working')}
                    style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600 }}
                  >
                    {todayRecord && todayRecord.clock_in ? '出勤済み' : '出勤する'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClockOut}
                    disabled={submittingPunch || !todayRecord || todayRecord.status === 'completed' || todayRecord.status === 'leave'}
                    style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600, background: todayRecord && todayRecord.status === 'working' ? 'var(--status-warning)' : undefined, color: todayRecord && todayRecord.status === 'working' ? '#fff' : undefined }}
                  >
                    退勤する
                  </button>
                </div>

                {todayRecord && todayRecord.clock_in && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <span>出勤時間: <strong>{todayRecord.formatted_clock_in || new Date(todayRecord.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                    {todayRecord.clock_out && (
                      <span>退勤時間: <strong>{todayRecord.formatted_clock_out || new Date(todayRecord.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. Stamp Correction Request Form */}
            {mode === 'correction' && (
              <div className="pane-card" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>対象日</label>
                    <input
                      type="date"
                      className="form-control"
                      value={reqTargetDate}
                      onChange={(e) => setReqTargetDate(e.target.value)}
                      required
                      style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>出勤時間</label>
                      <input
                        type="time"
                        className="form-control"
                        value={reqClockIn}
                        onChange={(e) => setReqClockIn(e.target.value)}
                        required
                        style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>退勤時間</label>
                      <input
                        type="time"
                        className="form-control"
                        value={reqClockOut}
                        onChange={(e) => setReqClockOut(e.target.value)}
                        required
                        style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>休憩時間 (分)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max="720"
                      value={reqBreakMinutes}
                      onChange={(e) => setReqBreakMinutes(Number(e.target.value))}
                      required
                      style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>申請理由</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      placeholder="例：出勤時の打刻押し忘れのため修正します。"
                      required
                      style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingRequest}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  >
                    {submittingRequest ? '送信中...' : '打刻修正申請を送信する'}
                  </button>
                </form>
              </div>
            )}

            {/* 3. Leave Request Form */}
            {mode === 'leave' && (
              <div className="pane-card" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>対象日</label>
                    <input
                      type="date"
                      className="form-control"
                      value={reqTargetDate}
                      onChange={(e) => setReqTargetDate(e.target.value)}
                      required
                      style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>休暇種別</label>
                    <select
                      className="form-control"
                      value={reqLeaveType}
                      onChange={(e) => setReqLeaveType(e.target.value as 'paid' | 'unpaid' | 'special')}
                      required
                      style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
                    >
                      <option value="paid">有給休暇</option>
                      <option value="unpaid">無給欠勤・休暇</option>
                      <option value="special">特別休暇</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>申請理由</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      placeholder="例：私用のため有給をいただきます。"
                      required
                      style={{ padding: '0.4rem 0.75rem', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.85rem' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingRequest}
                    style={{ width: '100%', marginTop: '0.25rem' }}
                  >
                    {submittingRequest ? '送信中...' : '休暇申請を送信する'}
                  </button>
                </form>
              </div>
            )}

            {/* 4. Requests/Approvals List */}
            {mode === 'requests' && (
              isAdmin ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.25rem 0' }}>
                    <span>承認待ち申請</span>
                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{pendingRequests.length}件</span>
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto' }}>
                    {pendingRequests.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0', margin: 0 }}>
                        未承認の申請はありません。
                      </p>
                    ) : (
                      pendingRequests.map(req => (
                        <div 
                          key={req.id} 
                          style={{ 
                            background: 'var(--bg-card)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: 'var(--border-radius-sm)', 
                            padding: '0.85rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.5rem',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>{req.user_login_id}</span>
                            <span className="badge badge-secondary">{getRequestTypeLabel(req.type)}</span>
                          </div>
                          
                          <div>
                            <strong>対象日:</strong> {req.target_date}<br />
                            {req.type === 'correction' ? (
                              <>
                                <strong>希望時間:</strong> {req.formatted_requested_clock_in} 〜 {req.formatted_requested_clock_out} (休憩: {req.requested_break_minutes}分)
                              </>
                            ) : (
                              <>
                                <strong>希望休暇:</strong> {req.leave_type === 'paid' ? '有給休暇' : req.leave_type === 'unpaid' ? '無給休暇' : '特別休暇'}
                              </>
                            )}
                            <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--bg-app)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                              理由: {req.reason}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button
                              type="button"
                              className="btn btn-xs btn-primary"
                              onClick={() => handleRequestAction(req.id, 'approve')}
                              style={{ flex: 1, padding: '0.35rem 0' }}
                            >
                              承認する
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-text"
                              onClick={() => handleRequestAction(req.id, 'reject')}
                              style={{ flex: 1, padding: '0.35rem 0', color: 'var(--status-alert)', border: '1px solid var(--border-color)' }}
                            >
                              却下
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.25rem 0' }}>
                    <span>あなたの承認待ち申請</span>
                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{requests.filter(r => r.status === 'pending').length}件</span>
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto' }}>
                    {requests.filter(r => r.status === 'pending').length === 0 ? (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-app)', border: '1px dashed var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
                        <div style={{ marginBottom: '0.5rem', opacity: 0.4 }}><AttendanceIcon size={24} /></div>
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>現在、承認待ちの申請はありません。</p>
                      </div>
                    ) : (
                      requests.filter(r => r.status === 'pending').map(req => (
                        <div 
                          key={req.id} 
                          style={{ 
                            background: 'var(--bg-card)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: 'var(--border-radius-sm)', 
                            padding: '0.85rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.5rem',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>{getRequestTypeLabel(req.type)}</span>
                            <span className="badge badge-warning">承認待ち</span>
                          </div>
                          <div>
                            <strong>対象日:</strong> {req.target_date}<br />
                            {req.type === 'correction' ? (
                              <>
                                <strong>希望時間:</strong> {req.formatted_requested_clock_in} 〜 {req.formatted_requested_clock_out} (休憩: {req.requested_break_minutes}分)
                              </>
                            ) : (
                              <>
                                <strong>希望休暇:</strong> {req.leave_type === 'paid' ? '有給休暇' : req.leave_type === 'unpaid' ? '無給休暇' : '特別休暇'}
                              </>
                            )}
                            <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--bg-app)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                              理由: {req.reason}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            )}

          </div>
        </div>

        {/* Dynamic Vector Arrow Area */}
        <div className="vector-arrow-container" style={{ opacity: 0.2 }}>
          <div className="vector-arrow">→</div>
        </div>

        {/* Right Pane (Monthly Attendance List or Requests List) - 2/3 Width */}
        <div className="master-pane">
          
          <div className="pane-header">
            <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {mode === 'requests' ? (
                <>申請履歴一覧</>
              ) : (
                <>{selectedMonth} 勤務記録一覧</>
              )}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {mode === 'requests' ? (
                <>レコード: {requests.length} 件</>
              ) : (
                <>レコード: {records.length} 件</>
              )}
            </span>
          </div>

          <div className="pane-body-scrollable">
            {mode === 'requests' ? (
              // Requests History Table
              loadingRequests ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6rem' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>申請履歴を読み込み中...</p>
                </div>
              ) : requests.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem', color: 'var(--text-muted)' }}>
                  <AttendanceIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                  <h3>送信済みの申請履歴はありません</h3>
                </div>
              ) : (
                <table className="stock-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      {isAdmin ? <th>申請者 / 申請日時</th> : <th>申請日時</th>}
                      <th>対象日 / 申請種別</th>
                      <th>希望内容</th>
                      <th>申請理由</th>
                      <th>状況 / 承認者</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(req => {
                      const reqDate = new Date(req.created_at || '').toLocaleString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const approvedDate = req.approved_at 
                        ? new Date(req.approved_at).toLocaleString('ja-JP', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '-';

                      return (
                        <tr key={req.id}>
                          {isAdmin ? (
                            <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600 }}>{req.user_login_id}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{reqDate}</div>
                            </td>
                          ) : (
                            <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {reqDate}
                            </td>
                          )}
                          <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600 }}>{req.target_date}</div>
                            <div style={{ marginTop: '0.25rem' }}>
                              <span className="badge badge-secondary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                                {getRequestTypeLabel(req.type)}
                              </span>
                            </div>
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            {req.type === 'correction' ? (
                              <>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem', fontWeight: 500 }}>
                                  {req.formatted_requested_clock_in} 〜 {req.formatted_requested_clock_out}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  (休憩: {req.requested_break_minutes}分)
                                </div>
                              </>
                            ) : (
                              <div style={{ fontWeight: 500 }}>
                                {req.leave_type === 'paid' ? '有給休暇' : req.leave_type === 'unpaid' ? '無給休暇' : '特別休暇'}
                              </div>
                            )}
                          </td>
                          <td style={{ verticalAlign: 'middle', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.reason || ''}>
                            {req.reason}
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <div>{getRequestStatusLabel(req.status)}</div>
                            {req.approver_login_id && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>
                                承認者: {req.approver_login_id} ({approvedDate})
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : (
              // Monthly Attendance Records Table
              loadingRecords ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6rem' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>勤務表を読み込み中...</p>
                </div>
              ) : records.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '4rem', color: 'var(--text-muted)' }}>
                  <AttendanceIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                  <h3>この月の勤務データがありません</h3>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>出勤打刻をするか、過去の勤務であれば打刻修正申請を行ってください。</p>
                </div>
              ) : (
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>勤務日</th>
                      {isAdmin && selectedStaffId === 'all' && <th>スタッフ</th>}
                      <th>出勤時間</th>
                      <th>退勤時間</th>
                      <th style={{ textAlign: 'right' }}>休憩 (分)</th>
                      <th style={{ textAlign: 'right' }}>労働時間</th>
                      <th>ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(record => {
                      const rowDate = new Date(record.work_date);
                      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                      const dayOfWeek = dayNames[rowDate.getDay()];
                      
                      // Highlight weekends
                      let dateColor = 'inherit';
                      if (rowDate.getDay() === 6) dateColor = '#3b82f6'; // Saturday (Blue)
                      if (rowDate.getDay() === 0) dateColor = 'var(--status-alert)'; // Sunday (Red)

                      return (
                        <tr 
                          key={record.id}
                          className={record.status === 'working' ? 'active-working-row' : ''}
                          style={{
                            background: record.status === 'working' ? 'rgba(245, 158, 11, 0.05)' : undefined
                          }}
                        >
                          <td style={{ fontWeight: 600, color: dateColor }}>
                            {record.work_date.substring(5)} ({dayOfWeek})
                          </td>
                          {isAdmin && selectedStaffId === 'all' && (
                            <td style={{ fontWeight: 500 }}>
                              {record.user?.login_id || '不明'}
                            </td>
                          )}
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                            {record.formatted_clock_in || '-'}
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                            {record.formatted_clock_out || '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>
                            {record.break_minutes} 分
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--mono)', fontSize: '0.9rem', color: record.work_minutes > 0 ? 'var(--primary)' : 'inherit' }}>
                            {record.formatted_work_time || '-'}
                          </td>
                          <td>
                            {getStatusLabel(record.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
