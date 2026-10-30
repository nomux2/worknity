import React, { useState } from 'react';
 
interface CommentCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { before_days: number; types: string[]; importances: string[] }) => Promise<void>;
}
 
export const CommentCleanupModal: React.FC<CommentCleanupModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [beforeDays, setBeforeDays] = useState<number>(30);
  const [types, setTypes] = useState<string[]>(['memo', 'log']);
  const [importances, setImportances] = useState<string[]>(['low', 'medium']);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
 
  if (!isOpen) return null;
 
  const handleTypeChange = (typeVal: string) => {
    setTypes(prev =>
      prev.includes(typeVal) ? prev.filter(t => t !== typeVal) : [...prev, typeVal]
    );
  };
 
  const handleImportanceChange = (impVal: string) => {
    setImportances(prev =>
      prev.includes(impVal) ? prev.filter(i => i !== impVal) : [...prev, impVal]
    );
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (types.length === 0 || importances.length === 0) {
      alert('コメント種類と重要度は少なくとも1つずつ選択してください。');
      return;
    }
 
    if (!window.confirm('条件に合致する古いコメントを一括削除します。この操作は元に戻せません。よろしいですか？')) {
      return;
    }
 
    setIsSubmitting(true);
    await onConfirm({
      before_days: beforeDays,
      types,
      importances,
    });
    setIsSubmitting(false);
    onClose();
  };
 
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
          <h3>コメントの一括クリーンアップ</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            タスクに紐づくコメント数が多くなり、見づらくなった場合に古いコメントを整理します。
          </p>
        </div>
 
        <form onSubmit={handleSubmit}>
          {/* 1. Target Period */}
          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label className="form-label"><strong>1. 対象期間の指定</strong></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.3rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="beforeDays"
                  checked={beforeDays === 30}
                  onChange={() => setBeforeDays(30)}
                />
                30日以上前のコメント
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="beforeDays"
                  checked={beforeDays === 90}
                  onChange={() => setBeforeDays(90)}
                />
                90日以上前のコメント
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="beforeDays"
                  checked={beforeDays === 0}
                  onChange={() => setBeforeDays(0)}
                />
                すべての過去コメント（本日以前）
              </label>
            </div>
          </div>
 
          {/* 2. Comment Types */}
          <div className="form-group" style={{ marginBottom: '1.2rem' }}>
            <label className="form-label"><strong>2. 対象となるコメント種類</strong></label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={types.includes('memo')}
                  onChange={() => handleTypeChange('memo')}
                />
                メモ (memo)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={types.includes('log')}
                  onChange={() => handleTypeChange('log')}
                />
                作業ログ (log)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={types.includes('communication')}
                  onChange={() => handleTypeChange('communication')}
                />
                連絡 (comm)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={types.includes('handover')}
                  onChange={() => handleTypeChange('handover')}
                />
                申し送り (handover)
              </label>
            </div>
          </div>
 
          {/* 3. Importance levels */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label"><strong>3. 対象となる重要度</strong></label>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.3rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={importances.includes('low')}
                  onChange={() => handleImportanceChange('low')}
                />
                低 (low)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={importances.includes('medium')}
                  onChange={() => handleImportanceChange('medium')}
                />
                中 (medium)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={importances.includes('high')}
                  onChange={() => handleImportanceChange('high')}
                />
                高 (high)
              </label>
            </div>
          </div>
 
          <div style={{ padding: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>警告：</span>
            一括削除を実行すると、該当するすべてのタスクコメントがデータベースから物理的に削除され、復元することはできません。
          </div>
 
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn btn-danger" disabled={isSubmitting}>
              {isSubmitting ? '削除実行中...' : '本当に一括削除する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
