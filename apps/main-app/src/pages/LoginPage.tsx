import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { Input } from '../components/ui/Input';
import { StockIcon, CustomerIcon, KeyIcon, TrendingUpIcon } from '../components/ui/Icons';

export const LoginPage: React.FC = () => {
  const { login, register, loginPasskey, startSocialLogin } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [loginId, setLoginId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!email) throw new Error('メールアドレスは必須です。');
        await register(email, loginId || email, password);
      } else {
        if (!loginId) throw new Error('ログインIDまたはメールアドレスを入力してください。');
        await login(loginId, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '認証処理に失敗しました。入力内容を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginPasskey(loginId || undefined);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'パスキー認証に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await startSocialLogin(provider);
      window.location.href = data.redirect_url;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'ソーシャルログインの初期化に失敗しました。');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-split">
      <div className="auth-form-side">
        <ThemeToggle className="theme-toggle-floating" />
        <div className="auth-card">
          <div className="auth-header">
            <h2>Worknity <span className="brand-dot"></span></h2>
            <p>{isRegister ? '新規オーナー登録（無料）' : '業務統合サービスにサインイン'}</p>
          </div>

          {error && (
            <div 
              className="error-message" 
              style={{ 
                textAlign: 'center', 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '0.75rem', 
                borderRadius: '8px',
                fontSize: '0.85rem'
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isRegister && (
              <Input
                id="email"
                type="email"
                label="メールアドレス (必須)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                required
                containerClassName="form-group"
              />
            )}

            <Input
              id="loginId"
              type="text"
              label={isRegister ? 'ログインID (オプション)' : 'ログインID または メールアドレス'}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder={isRegister ? '未入力時はメールアドレスを使用' : 'owner@example.com または admin'}
              required={!isRegister}
              containerClassName="form-group"
            />

            <Input
              id="password"
              type="password"
              label="パスワード (8文字以上)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              containerClassName="form-group"
            />

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? (
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
              ) : (
                isRegister ? 'アカウント作成' : 'サインイン'
              )}
            </button>
          </form>

          {!isRegister && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePasskeyLogin}
              disabled={loading}
              style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '-0.5rem' }}
            >
              パスキーでログイン (指紋・顔認証)
            </button>
          )}

          <div className="auth-divider">または</div>

          <div className="social-buttons">
            <button type="button" className="btn btn-social" onClick={() => handleSocialLogin('google')} disabled={loading}>
              Google
            </button>
            <button type="button" className="btn btn-social" onClick={() => handleSocialLogin('line')} disabled={loading}>
              LINE
            </button>
          </div>

          <div className="social-note">
            【開発用モック】ボタンをクリックすると、ダミー連携アカウントからデモ組織が即座に自動生成されログインします。
          </div>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setEmail('');
                setLoginId('');
                setPassword('');
              }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.9rem' }}
            >
              {isRegister ? 'すでにアカウントをお持ちですか？ ログイン' : '新規オーナー登録はこちら'}
            </button>
          </div>
        </div>
      </div>

      <div className="auth-promo-side">
        <div className="promo-content">
          <div className="promo-tagline">人・物・金の面倒を極限まで省く</div>
          <h1 className="promo-title">
            中小企業・個人事業主のための<br />
            業務統合サービス
          </h1>
          
          <div className="promo-features">
            <div className="promo-feature-item">
              <div className="promo-feature-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StockIcon size={24} />
              </div>
              <div className="promo-feature-text">
                <h4>超シンプルな在庫管理</h4>
                <p>1クリックでの入出庫や棚卸。PC操作が苦手なスタッフでも直感的に使いこなせる画面設計です。</p>
              </div>
            </div>

            <div className="promo-feature-item">
              <div className="promo-feature-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CustomerIcon size={24} />
              </div>
              <div className="promo-feature-text">
                <h4>複数人でのリアルタイム共有</h4>
                <p>組織ごとのマルチテナント管理により、複数拠点やチーム間でのリアルタイムな情報共有が即座に行えます。</p>
              </div>
            </div>

            <div className="promo-feature-item">
              <div className="promo-feature-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyIcon size={24} />
              </div>
              <div className="promo-feature-text">
                <h4>パスキー（生体認証）対応</h4>
                <p>指紋や顔認証で安全・簡単にサインイン。面倒なパスワードを覚える必要はありません。</p>
              </div>
            </div>

            <div className="promo-feature-item">
              <div className="promo-feature-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUpIcon size={24} />
              </div>
              <div className="promo-feature-text">
                <h4>自動で履歴をグラフ化</h4>
                <p>過去7日間の推移を美しいスパークラインで可視化。在庫の動きをひと目で把握できます。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
