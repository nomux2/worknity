import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../hooks/useWorkflow';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import type { ReportTemplate } from '../types/workflow';

interface Member {
    id: number;
    email: string;
    login_id: string;
}

interface WorkflowSettingsProps {
    addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const WorkflowSettings: React.FC<WorkflowSettingsProps> = ({ addToast }) => {
    const { fetchWithAuth } = useAuth();
    const {
        templates,
        loadingTemplates,
        fetchTemplates,
        createTemplate,
        updateTemplate,
        deleteTemplate,

        classes,
        loadingClasses,
        fetchClasses,
        createClass,
        updateClass,
        deleteClass,
        assignUserToClass,
        removeUserFromClass,

        orderSettings,
        loadingSettings,
        fetchOrderSettings,
        updateOrderSettings,
    } = useWorkflow(addToast);

    // Tab State: 'classes' | 'templates' | 'order_settings'
    const [subTab, setSubTab] = useState<'classes' | 'templates' | 'order_settings'>('classes');

    // Members list for user assignments
    const [members, setMembers] = useState<Member[]>([]);

    // Form States - Classes
    const [className, setClassName] = useState<string>('');
    const [classPriority, setClassPriority] = useState<number>(10);
    const [editingClassId, setEditingClassId] = useState<number | null>(null);
    const [selectedUserForClass, setSelectedUserForClass] = useState<Record<number, number>>({});

    // Form States - Templates
    const [showTemplateForm, setShowTemplateForm] = useState<boolean>(false);
    const [templateId, setTemplateId] = useState<number | null>(null);
    const [templateName, setTemplateName] = useState<string>('');
    const [templateDesc, setTemplateDesc] = useState<string>('');
    const [templateType, setTemplateType] = useState<'report' | 'application'>('report');
    const [stepsCount, setStepsCount] = useState<number>(1);
    const [fields, setFields] = useState<any[]>([
        { label: '件名', name: 'title', type: 'text', required: true, step: 1 }
    ]);
    const [routes, setRoutes] = useState<any[]>([
        { step_number: 1, approver_type: 'class', approval_class_id: '', approver_user_id: '' }
    ]);

    // Form States - Order Settings
    const [orderReqApproval, setOrderReqApproval] = useState<boolean>(false);
    const [orderThreshold, setOrderThreshold] = useState<string>('');
    const [orderTemplateId, setOrderTemplateId] = useState<string>('');

    // Fetch members list
    const fetchMembers = useCallback(async () => {
        try {
            const res = await fetchWithAuth('/api/users');
            if (res.ok) {
                const data = await res.json();
                setMembers(data);
            }
        } catch (e) {
            console.error(e);
        }
    }, [fetchWithAuth]);

    useEffect(() => {
        fetchClasses();
        fetchTemplates();
        fetchMembers();
        fetchOrderSettings();
    }, [fetchClasses, fetchTemplates, fetchMembers, fetchOrderSettings]);

    useEffect(() => {
        if (orderSettings) {
            setOrderReqApproval(orderSettings.require_approval);
            setOrderThreshold(orderSettings.approval_threshold?.toString() || '');
            setOrderTemplateId(orderSettings.report_template_id?.toString() || '');
        }
    }, [orderSettings]);

    // Handle Class Actions
    const handleSaveClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!className.trim()) {
            addToast('クラス名は必須です。', 'warning');
            return;
        }

        let success = false;
        if (editingClassId) {
            success = await updateClass(editingClassId, { name: className, priority: classPriority });
        } else {
            success = await createClass({ name: className, priority: classPriority });
        }

        if (success) {
            setClassName('');
            setClassPriority(10);
            setEditingClassId(null);
        }
    };

    const handleAssignUser = async (classId: number) => {
        const userId = selectedUserForClass[classId];
        if (!userId) {
            addToast('ユーザーを選択してください。', 'warning');
            return;
        }
        const success = await assignUserToClass(classId, userId);
        if (success) {
            fetchClasses(); // リロードして紐付けメンバー更新
        }
    };

    const handleRemoveUser = async (classId: number, userId: number) => {
        if (confirm('割り当てを解除しますか？')) {
            const success = await removeUserFromClass(classId, userId);
            if (success) {
                fetchClasses();
            }
        }
    };

    // Handle Template Actions
    const handleAddField = () => {
        setFields([...fields, { label: '', name: '', type: 'text', required: false, step: 1 }]);
    };

    const handleRemoveField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const handleFieldChange = (index: number, key: string, value: any) => {
        const updated = [...fields];
        updated[index] = { ...updated[index], [key]: value };
        setFields(updated);
    };

    const handleStepsChange = (count: number) => {
        setStepsCount(count);
        const updatedRoutes = [...routes];
        // ステップ数に応じて承認ルート枠の個数を調整
        if (updatedRoutes.length < count) {
            for (let i = updatedRoutes.length + 1; i <= count; i++) {
                updatedRoutes.push({ step_number: i, approver_type: 'class', approval_class_id: '', approver_user_id: '' });
            }
        } else if (updatedRoutes.length > count) {
            updatedRoutes.splice(count);
        }
        setRoutes(updatedRoutes);
    };

    const handleRouteValueChange = (index: number, key: string, value: any) => {
        const updated = [...routes];
        updated[index] = { ...updated[index], [key]: value };
        setRoutes(updated);
    };

    const handleSaveTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!templateName.trim()) {
            addToast('テンプレート名は必須です。', 'warning');
            return;
        }

        // バリデーションチェック
        const invalidFields = fields.some(f => !f.label.trim() || !f.name.trim());
        if (invalidFields) {
            addToast('フィールドの項目名とキー名はすべて入力してください。', 'warning');
            return;
        }

        const invalidRoutes = routes.some(r => 
            (r.approver_type === 'class' && !r.approval_class_id) || 
            (r.approver_type === 'user' && !r.approver_user_id)
        );
        if (invalidRoutes) {
            addToast('承認ルートの担当クラスまたはユーザーをすべて選択してください。', 'warning');
            return;
        }

        // 整数にパースして整形
        const formattedRoutes = routes.map(r => ({
            step_number: r.step_number,
            approver_type: r.approver_type,
            approval_class_id: r.approver_type === 'class' ? parseInt(r.approval_class_id) : null,
            approver_user_id: r.approver_type === 'user' ? parseInt(r.approver_user_id) : null,
        }));

        let success = false;
        const payload = {
            name: templateName,
            description: templateDesc,
            type: templateType,
            steps_count: stepsCount,
            fields,
            routes: formattedRoutes
        };

        if (templateId) {
            success = await updateTemplate(templateId, payload);
        } else {
            success = await createTemplate(payload);
        }

        if (success) {
            setShowTemplateForm(false);
            setTemplateId(null);
            setTemplateName('');
            setTemplateDesc('');
            setTemplateType('report');
            setStepsCount(1);
            setFields([{ label: '件名', name: 'title', type: 'text', required: true, step: 1 }]);
            setRoutes([{ step_number: 1, approver_type: 'class', approval_class_id: '', approver_user_id: '' }]);
        }
    };

    const handleEditTemplate = (tmpl: ReportTemplate) => {
        setTemplateId(tmpl.id);
        setTemplateName(tmpl.name);
        setTemplateDesc(tmpl.description || '');
        setTemplateType(tmpl.type);
        setStepsCount(tmpl.steps_count);
        setFields(tmpl.fields);
        
        // 既存ルート設定をマッピング
        const existingRoutes = tmpl.routes?.map(r => ({
            step_number: r.step_number,
            approver_type: r.approver_type,
            approval_class_id: r.approval_class_id?.toString() || '',
            approver_user_id: r.approver_user_id?.toString() || '',
        })) || [];
        
        setRoutes(existingRoutes);
        setShowTemplateForm(true);
    };

    // Handle Order Settings Save
    const handleSaveOrderSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            require_approval: orderReqApproval,
            approval_threshold: orderThreshold ? parseInt(orderThreshold) : null,
            report_template_id: orderTemplateId ? parseInt(orderTemplateId) : null
        };
        await updateOrderSettings(payload);
    };

    return (
        <div className="workflow-settings-container" style={{ padding: '20px' }}>
            <div className="glass-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-main)' }}>承認ワークフロー設定</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
                        被承認リソースへの相乗り用マスタ、テンプレート、しきい値設定を管理します。
                    </p>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="tab-menu" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    className={`btn ${subTab === 'classes' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSubTab('classes')}
                >
                    承認役職クラス管理
                </button>
                <button
                    className={`btn ${subTab === 'templates' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSubTab('templates')}
                >
                    申請テンプレート定義
                </button>
                <button
                    className={`btn ${subTab === 'order_settings' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSubTab('order_settings')}
                >
                    発注承認条件設定
                </button>
            </div>

            {/* Sub Tab: Classes */}
            {subTab === 'classes' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                    {/* Add/Edit Class Form */}
                    <div className="card" style={{ padding: '20px', height: 'fit-content' }}>
                        <h3>{editingClassId ? '役職クラス編集' : '役職クラス新規追加'}</h3>
                        <form onSubmit={handleSaveClass}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>クラス名/役職名</label>
                                <Input
                                    value={className}
                                    onChange={(e) => setClassName(e.target.value)}
                                    placeholder="例: 部長, 経理"
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>優先度 (序列の高さ)</label>
                                <Input
                                    type="number"
                                    value={classPriority}
                                    onChange={(e) => setClassPriority(parseInt(e.target.value))}
                                    placeholder="数値が大きいほど上位役職"
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    ※承認ルート内の序列順位比較などに使用します。
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    保存
                                </button>
                                {editingClassId && (
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => {
                                            setEditingClassId(null);
                                            setClassName('');
                                            setClassPriority(10);
                                        }}
                                    >
                                        キャンセル
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Classes List */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3>登録済みのクラスと所属メンバー</h3>
                        {loadingClasses ? (
                            <p>読み込み中...</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {classes.map((cls) => (
                                    <div
                                        key={cls.id}
                                        className="class-card"
                                        style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '15px',
                                            backgroundColor: 'rgba(255,255,255,0.02)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <div>
                                                <strong style={{ fontSize: '1.1rem' }}>{cls.name}</strong>
                                                <span className="badge badge-secondary" style={{ marginLeft: '10px' }}>
                                                    優先度: {cls.priority}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button
                                                    className="btn btn-outline btn-xs"
                                                    onClick={() => {
                                                        setEditingClassId(cls.id);
                                                        setClassName(cls.name);
                                                        setClassPriority(cls.priority);
                                                    }}
                                                >
                                                    編集
                                                </button>
                                                <button
                                                    className="btn btn-outline btn-xs"
                                                    style={{ color: 'var(--accent-red)' }}
                                                    onClick={() => {
                                                        if (confirm('このクラスを削除しますか？')) {
                                                            deleteClass(cls.id);
                                                        }
                                                    }}
                                                >
                                                    削除
                                                </button>
                                            </div>
                                        </div>

                                        {/* Member assignment UI */}
                                        <div style={{ fontSize: '0.9rem', borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                                            <div style={{ marginBottom: '8px' }}>
                                                所属ユーザー: {cls.users?.map(u => (
                                                    <span
                                                        key={u.id}
                                                        className="badge badge-primary"
                                                        style={{ marginRight: '5px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                                    >
                                                        {u.login_id || u.email}
                                                        <span
                                                            style={{ cursor: 'pointer', fontWeight: 'bold' }}
                                                            onClick={() => handleRemoveUser(cls.id, u.id)}
                                                        >
                                                            ×
                                                        </span>
                                                    </span>
                                                )) || <span style={{ color: 'var(--text-muted)' }}>メンバー未割り当て</span>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                <select
                                                    className="input"
                                                    value={selectedUserForClass[cls.id] || ''}
                                                    onChange={(e) => setSelectedUserForClass({
                                                        ...selectedUserForClass,
                                                        [cls.id]: parseInt(e.target.value)
                                                    })}
                                                    style={{ flex: 1, padding: '5px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                                >
                                                    <option value="">-- 追加するユーザーを選択 --</option>
                                                    {members.map(m => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.login_id || m.email}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleAssignUser(cls.id)}
                                                >
                                                    追加
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sub Tab: Templates */}
            {subTab === 'templates' && (
                <div>
                    {!showTemplateForm ? (
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3>テンプレート一覧</h3>
                                <button className="btn btn-primary" onClick={() => setShowTemplateForm(true)}>
                                    新規テンプレート作成
                                </button>
                            </div>

                            {loadingTemplates ? (
                                <p>読み込み中...</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                                    {templates.map(tmpl => (
                                        <div
                                            key={tmpl.id}
                                            className="card"
                                            style={{
                                                padding: '15px',
                                                border: '1px solid var(--border)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'between'
                                            }}
                                        >
                                            <div>
                                                <h4 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{tmpl.name}</h4>
                                                <span className="badge badge-secondary" style={{ marginBottom: '10px' }}>
                                                    {tmpl.type === 'report' ? '報告/日報' : '申請/稟議'}
                                                </span>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', minHeight: '40px' }}>
                                                    {tmpl.description || '説明なし'}
                                                </p>
                                                <p style={{ fontSize: '0.85rem' }}>
                                                    承認ステップ: <strong>{tmpl.steps_count}段階</strong>
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                                                <button
                                                    className="btn btn-outline btn-xs"
                                                    onClick={() => handleEditTemplate(tmpl)}
                                                    style={{ flex: 1 }}
                                                >
                                                    編集
                                                </button>
                                                <button
                                                    className="btn btn-outline btn-xs"
                                                    style={{ color: 'var(--accent-red)', flex: 1 }}
                                                    onClick={() => {
                                                        if (confirm('本当に削除しますか？')) {
                                                            deleteTemplate(tmpl.id);
                                                        }
                                                    }}
                                                >
                                                    削除
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        // Template Form
                        <div className="card" style={{ padding: '20px' }}>
                            <h3>{templateId ? 'テンプレート編集' : '新規テンプレート作成'}</h3>
                            <form onSubmit={handleSaveTemplate}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>テンプレート名</label>
                                        <Input
                                            value={templateName}
                                            onChange={(e) => setTemplateName(e.target.value)}
                                            placeholder="例: 購入申請, 旅費精算, 日報"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>種別</label>
                                        <select
                                            className="input"
                                            value={templateType}
                                            onChange={(e) => setTemplateType(e.target.value as any)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                        >
                                            <option value="report">報告/日報（記録用途）</option>
                                            <option value="application">申請/稟議（決裁用途）</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px' }}>説明文</label>
                                    <textarea
                                        className="input"
                                        value={templateDesc}
                                        onChange={(e) => setTemplateDesc(e.target.value)}
                                        placeholder="用途や書き方の説明"
                                        style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                    />
                                </div>

                                {/* Step Counter */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '5px' }}>承認フローのステップ数 (1〜3)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        min={1}
                                        max={3}
                                        value={stepsCount}
                                        onChange={(e) => handleStepsChange(parseInt(e.target.value) || 1)}
                                        style={{ width: '100px', padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                    />
                                </div>

                                {/* Approval Route Config */}
                                <div style={{ marginBottom: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                    <h4>承認ルート設定</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {routes.map((route, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '15px',
                                                    padding: '10px',
                                                    border: '1px dashed var(--border)',
                                                    borderRadius: '6px'
                                                }}
                                            >
                                                <strong style={{ width: '80px' }}>第 {route.step_number} 段階:</strong>
                                                
                                                <select
                                                    className="input"
                                                    value={route.approver_type}
                                                    onChange={(e) => handleRouteValueChange(idx, 'approver_type', e.target.value)}
                                                    style={{ width: '120px', padding: '5px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                                >
                                                    <option value="class">役職クラス指定</option>
                                                    <option value="user">ユーザー個人指定</option>
                                                </select>

                                                {route.approver_type === 'class' ? (
                                                    <select
                                                        className="input"
                                                        value={route.approval_class_id}
                                                        onChange={(e) => handleRouteValueChange(idx, 'approval_class_id', e.target.value)}
                                                        style={{ width: '200px', padding: '5px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                                    >
                                                        <option value="">-- 承認クラスを選択 --</option>
                                                        {classes.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <select
                                                        className="input"
                                                        value={route.approver_user_id}
                                                        onChange={(e) => handleRouteValueChange(idx, 'approver_user_id', e.target.value)}
                                                        style={{ width: '200px', padding: '5px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                                    >
                                                        <option value="">-- ユーザーを選択 --</option>
                                                        {members.map(m => (
                                                            <option key={m.id} value={m.id}>{m.login_id || m.email}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Dynamic Field Builder */}
                                <div style={{ marginBottom: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <h4>入力項目（フォーム設計）</h4>
                                        <button type="button" className="btn btn-outline btn-sm" onClick={handleAddField}>
                                            項目追加
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {fields.map((field, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr auto',
                                                    gap: '10px',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Input
                                                    value={field.label}
                                                    onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                                                    placeholder="項目名 (表示名)"
                                                />
                                                <Input
                                                    value={field.name}
                                                    onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                                                    placeholder="キー名 (英語一意)"
                                                />
                                                <select
                                                    className="input"
                                                    value={field.type}
                                                    onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                                                    style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                                >
                                                    <option value="text">テキスト (1行)</option>
                                                    <option value="textarea">テキスト (複数行)</option>
                                                    <option value="number">数値</option>
                                                    <option value="date">日付</option>
                                                    <option value="file">ファイル/画像添付</option>
                                                </select>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={field.required}
                                                        onChange={(e) => handleFieldChange(idx, 'required', e.target.checked)}
                                                    />
                                                    必須
                                                </label>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>入力可能Step: </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={3}
                                                        value={field.step || 1}
                                                        onChange={(e) => handleFieldChange(idx, 'step', parseInt(e.target.value) || 1)}
                                                        style={{ width: '45px', padding: '3px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)' }}
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline btn-xs"
                                                    style={{ color: 'var(--accent-red)' }}
                                                    onClick={() => handleRemoveField(idx)}
                                                    disabled={fields.length === 1}
                                                >
                                                    削除
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                        保存
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ flex: 1 }}
                                        onClick={() => setShowTemplateForm(false)}
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* Sub Tab: Order Settings */}
            {subTab === 'order_settings' && (
                <div className="card" style={{ padding: '20px', maxWidth: '600px' }}>
                    <h3>発注確定時の承認ルート連動設定</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                        発注モジュール（Purchase Orders）で担当者が発注を確定させようとした際、要件に応じて自動的に「購入申請」などのワークフローを挟む設定です。
                    </p>

                    {loadingSettings ? (
                        <p>読み込み中...</p>
                    ) : (
                        <form onSubmit={handleSaveOrderSettings}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '20px' }}>
                                <div>
                                    <strong style={{ display: 'block' }}>発注時に承認を必須とする</strong>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        有効にすると、確定時に自動で承認申請データが作成されます。
                                    </span>
                                </div>
                                <Switch
                                    checked={orderReqApproval}
                                    onChange={(e) => setOrderReqApproval(e.target.checked)}
                                />
                            </div>

                            {orderReqApproval && (
                                <>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>
                                            使用する申請テンプレート
                                        </label>
                                        <select
                                            className="input"
                                            value={orderTemplateId}
                                            onChange={(e) => setOrderTemplateId(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                                            required
                                        >
                                            <option value="">-- 連動テンプレートを選択 --</option>
                                            {templates.filter(t => t.type === 'application').map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ marginBottom: '25px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>
                                            承認が必要な金額のしきい値（円）
                                        </label>
                                        <Input
                                            type="number"
                                            value={orderThreshold}
                                            onChange={(e) => setOrderThreshold(e.target.value)}
                                            placeholder="例: 100000 (これ未満の発注は自動的に承認・確定されます。空なら全額必須)"
                                        />
                                    </div>
                                </>
                            )}

                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                設定を保存する
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};
