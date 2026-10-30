import React, { useState } from 'react';

interface KioskUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

export const KioskUnlockModal: React.FC<KioskUnlockModalProps> = ({
  isOpen,
  onClose,
  onUnlockSuccess,
  fetchWithAuth,
}) => {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (password.length < 10) {
      setPassword(prev => prev + num);
      setError('');
    }
  };

  const handleClear = () => {
    setPassword('');
    setError('');
  };

  const handleConfirm = async () => {
    if (!password) {
      setError('パスワードを入力してください。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetchWithAuth('/api/catalog/unlock', {
        method: 'POST',
        body: JSON.stringify({ unlock_password: password }),
      });

      if (res.ok) {
        onUnlockSuccess();
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'パスワードが正しくありません。');
        setPassword('');
      }
    } catch (err) {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div className="modal-content" style={{
        background: 'var(--bg-card, #1e1e2e)',
        border: '1px solid var(--border-color, #313244)',
        borderRadius: '16px',
        padding: '24px',
        width: '320px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        color: 'var(--text-main, #cdd6f4)',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 600 }}>キオスク解除認証</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '0.875rem', color: 'var(--text-muted, #a6adc8)' }}>
          管理画面に戻るためのパスワードを入力してください
        </p>

        {/* Display screen */}
        <div style={{
          background: '#11111b',
          borderRadius: '8px',
          height: '48px',
          lineHeight: '48px',
          fontSize: '1.5rem',
          letterSpacing: '8px',
          fontWeight: 'bold',
          marginBottom: '8px',
          color: 'var(--text-main, #cdd6f4)',
        }}>
          {'*'.repeat(password.length)}
        </div>

        {error && (
          <div style={{
            color: '#f38ba8',
            fontSize: '0.8rem',
            marginBottom: '16px',
            minHeight: '1.2rem',
          }}>
            {error}
          </div>
        )}

        {/* Numpad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              disabled={loading}
              style={{
                height: '52px',
                fontSize: '1.25rem',
                borderRadius: '8px',
                border: '1px solid #45475a',
                background: '#313244',
                color: '#cdd6f4',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={loading}
            style={{
              height: '52px',
              fontSize: '1rem',
              borderRadius: '8px',
              border: '1px solid #f38ba8',
              background: 'rgba(243, 139, 168, 0.1)',
              color: '#f38ba8',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Clear
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            disabled={loading}
            style={{
              height: '52px',
              fontSize: '1.25rem',
              borderRadius: '8px',
              border: '1px solid #45475a',
              background: '#313244',
              color: '#cdd6f4',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            0
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !password}
            style={{
              height: '52px',
              fontSize: '1rem',
              borderRadius: '8px',
              border: '1px solid #a6e3a1',
              background: 'rgba(166, 227, 161, 0.1)',
              color: '#a6e3a1',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            確認
          </button>
        </div>

        <button
          onClick={onClose}
          disabled={loading}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #a6adc8)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            textDecoration: 'underline',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
};
