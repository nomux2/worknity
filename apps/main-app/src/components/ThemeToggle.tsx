import React, { useState, useEffect } from 'react';
import { SunIcon, MoonIcon } from './ui/Icons';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const hasDarkClass = document.documentElement.classList.contains('dark-mode');
    
    if (savedTheme === 'dark' || (!savedTheme && hasDarkClass)) {
      document.documentElement.classList.add('dark-mode');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark-mode');
      setIsDark(false);
    }
  }, []);

  const toggle = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    if (newVal) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button 
      onClick={toggle}
      className={`theme-toggle-btn ${className}`}
      type="button"
      aria-label="テーマ切り替え"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
    >
      {isDark ? (
        <>
          <SunIcon size={16} />
          <span>ライトモード</span>
        </>
      ) : (
        <>
          <MoonIcon size={16} />
          <span>ダークモード</span>
        </>
      )}
    </button>
  );
};
