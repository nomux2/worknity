import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const SocialCallbackPage: React.FC = () => {
  const { setAuthToken } = useAuth();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (!token) {
          throw new Error('トークンがURLパラメータに含まれていません。');
        }

        // Set token and load user details
        await setAuthToken(token);
        
        // Redirect to home/dashboard
        window.location.href = '/';
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'ソーシャル認証の処理中にエラーが発生しました。');
        
        // After 3 seconds, redirect back to login
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleCallback();
  }, [setAuthToken]);

  return (
    <div className="loading-screen">
      {error ? (
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>認証エラー</h2>
          <p>{error}</p>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.9rem' }}>
            3秒後にログイン画面へ戻ります...
          </p>
        </div>
      ) : (
        <>
          <div className="spinner"></div>
          <h2>ソーシャル認証を実行中...</h2>
          <p style={{ color: 'var(--text-muted)' }}>そのままお待ちください。</p>
        </>
      )}
    </div>
  );
};
