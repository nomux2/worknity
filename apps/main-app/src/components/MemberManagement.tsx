import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Input } from './ui/Input';
import { CustomerIcon } from './ui/Icons';

interface Member {
  id: number;
  email: string;
  login_id: string;
  role: string;
  created_at: string;
}

interface MemberManagementProps {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({ addToast }) => {
  const { user, fetchWithAuth } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [loginId, setLoginId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isAdmin = user?.role === 'admin';

  const fetchMembers = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/users');
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      } else {
        addToast('メンバー一覧の取得に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('ネットワークエラーが発生しました。', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, fetchWithAuth, addToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      addToast('メールアドレスとパスワードは必須です。', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          login_id: loginId || undefined,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        addToast('新しいメンバーを追加しました。', 'success');
        setEmail('');
        setLoginId('');
        setPassword('');
        setShowAddModal(false);
        fetchMembers();
      } else {
        addToast(data.message || 'メンバーの追加に失敗しました。', 'error');
      }
    } catch (e) {
      addToast('リクエストの送信中にエラーが発生しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="section-card kiosk-main-card" style={{ padding: '2rem', textAlign: 'center', animation: 'fadeIn 0.2s ease-out' }}>
        <h2 style={{ color: 'var(--status-danger)' }}>アクセス制限</h2>
        <p style={{ color: 'var(--text-muted)' }}>メンバー管理画面は管理者（admin）のみが閲覧可能です。</p>
      </div>
    );
  }

  return (
    <div className="section-card kiosk-main-card" style={{ padding: '2rem', animation: 'fadeIn 0.2s ease-out' }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CustomerIcon size={24} />
          <h2>メンバー管理システム</h2>
        </div>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          新規スタッフ追加
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', marginTop: '1rem' }}>
        {loading ? (
          <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '1rem' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-muted)' }}>メンバー一覧を読み込んでいます...</p>
          </div>
        ) : members.length === 0 ? (
          <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '3rem', color: 'var(--text-muted)' }}>
            <CustomerIcon size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <h3>登録されているメンバーはいません。</h3>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
            <table className="stock-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ログインID</th>
                  <th>メールアドレス</th>
                  <th>ロール</th>
                  <th>登録日時</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>#{member.id}</td>
                    <td style={{ fontWeight: 600 }}>{member.login_id}</td>
                    <td>{member.email}</td>
                    <td>
                      <span className={`badge ${member.role === 'admin' ? 'badge-good' : 'badge-warning'}`}>
                        {member.role === 'admin' ? '管理者' : 'スタッフ'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(member.created_at).toLocaleString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="quick-launcher-overlay" onClick={() => setShowAddModal(false)}>
          <div 
            className="quick-launcher-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '450px', 
              borderRadius: 'var(--border-radius-lg)', 
              padding: '2rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              新規スタッフの追加
            </h3>
            
            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Input
                id="email"
                type="email"
                label="メールアドレス (必須)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
                required
              />

              <Input
                id="loginId"
                type="text"
                label="ログインID (任意)"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="staff_sato"
              />

              <Input
                id="password"
                type="password"
                label="パスワード (必須 - 8文字以上)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? '追加中...' : 'メンバーを追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
