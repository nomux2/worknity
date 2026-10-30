import React, { useEffect, useState } from 'react';
import { useWorkflow } from '../hooks/useWorkflow';
import { Input } from './ui/Input';
import type { Report, ReportTemplate } from '../types/workflow';

interface WorkflowProps {
    addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const WorkflowManagement: React.FC<WorkflowProps> = ({ addToast }) => {
    const {
        templates,
        fetchTemplates,
        reports,
        loadingReports,
        fetchReports,
        fetchReport,
        createReport,
        approveReport,
        rejectReport,
    } = useWorkflow(addToast);

    // List navigation states
    const [tab, setTab] = useState<'my' | 'pending'>('my');
    const [page, setPage] = useState<number>(1);

    // View States: 'list' | 'create' | 'detail'
    const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
    
    // Detail States
    const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
    const [detailedReport, setDetailedReport] = useState<Report | null>(null);
    const [approvableData, setApprovableData] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
    
    // Form States
    const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
    const [formAttributes, setFormAttributes] = useState<Record<string, any>>({});
    const [approvalComment, setApprovalComment] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    useEffect(() => {
        fetchReports(tab, page);
        fetchTemplates();
    }, [tab, page, fetchReports, fetchTemplates]);

    // Handle tab change
    const handleTabChange = (newTab: 'my' | 'pending') => {
        setTab(newTab);
        setPage(1);
        setView('list');
    };

    // Load detailed report
    const handleViewDetail = async (reportId: number) => {
        setLoadingDetail(true);
        setView('detail');
        setSelectedReportId(reportId);
        setApprovalComment('');
        try {
            const data = await fetchReport(reportId);
            if (data) {
                setDetailedReport(data.report);
                setApprovableData(data.approvable_data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDetail(false);
        }
    };

    // Dynamic Form render helpers
    const handleFieldChange = (name: string, value: any) => {
        setFormAttributes({
            ...formAttributes,
            [name]: value
        });
    };

    const handleCreateNewClick = () => {
        setSelectedTemplate(null);
        setFormAttributes({});
        setView('create');
    };

    const handleTemplateSelect = (tmplId: number) => {
        const tmpl = templates.find(t => t.id === tmplId) || null;
        setSelectedTemplate(tmpl);
        
        // 初期値のセット
        const initialAttr: Record<string, any> = {};
        if (tmpl) {
            tmpl.fields.forEach(field => {
                if (field.type === 'number') initialAttr[field.name] = '';
                else if (field.type === 'checkbox') initialAttr[field.name] = false;
                else initialAttr[field.name] = '';
            });
        }
        setFormAttributes(initialAttr);
    };

    const handleSaveReport = async (status: 'draft' | 'pending') => {
        if (!selectedTemplate) return;
        setSubmitting(true);
        
        // 簡易必須チェック
        let hasError = false;
        selectedTemplate.fields.forEach(field => {
            if (status === 'pending' && field.required && field.step === 1) {
                if (!formAttributes[field.name]) {
                    addToast(`${field.label}は必須項目です。`, 'warning');
                    hasError = true;
                }
            }
        });

        if (hasError) {
            setSubmitting(false);
            return;
        }

        const report = await createReport({
            report_template_id: selectedTemplate.id,
            status,
            attributes: formAttributes
        });

        setSubmitting(false);
        if (report) {
            setView('list');
            fetchReports(tab, page);
        }
    };

    // Handle Approve / Reject
    const handleApprove = async () => {
        if (!selectedReportId) return;
        setSubmitting(true);
        const success = await approveReport(selectedReportId, approvalComment);
        setSubmitting(false);
        if (success) {
            setView('list');
            fetchReports(tab, page);
        }
    };

    const handleReject = async () => {
        if (!selectedReportId) return;
        if (!approvalComment.trim()) {
            addToast('差し戻し/却下時にはコメント（理由）を入力してください。', 'warning');
            return;
        }
        setSubmitting(true);
        const success = await rejectReport(selectedReportId, approvalComment);
        setSubmitting(false);
        if (success) {
            setView('list');
            fetchReports(tab, page);
        }
    };

    // Form inputs renderer
    const renderFieldInput = (field: any, isReadOnly = false) => {
        const val = formAttributes[field.name] ?? '';
        
        if (field.type === 'textarea') {
            return (
                <textarea
                    className="input"
                    value={val}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={isReadOnly}
                    placeholder={field.label}
                    style={{ width: '100%', minHeight: '80px', padding: '10px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px' }}
                />
            );
        }

        if (field.type === 'number') {
            return (
                <Input
                    type="number"
                    value={val}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={isReadOnly}
                    placeholder="0"
                />
            );
        }

        if (field.type === 'date') {
            return (
                <Input
                    type="date"
                    value={val}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    disabled={isReadOnly}
                />
            );
        }

        if (field.type === 'file') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <Input
                        type="file"
                        onChange={(e) => {
                            // ファイルアップロードのモック（V1ではテキストベースのエンコードまたはダミーパス）
                            if (e.target.files && e.target.files[0]) {
                                handleFieldChange(field.name, `添付ファイル: ${e.target.files[0].name}`);
                            }
                        }}
                        disabled={isReadOnly}
                    />
                    {val && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{val}</span>}
                </div>
            );
        }

        return (
            <Input
                type="text"
                value={val}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                disabled={isReadOnly}
                placeholder={field.label}
            />
        );
    };

    // Render Preview of Linked Approvable Model
    const renderApprovablePreview = () => {
        if (!detailedReport || !detailedReport.approvable_type || !approvableData) return null;

        const isPurchaseOrder = detailedReport.approvable_type.includes('PurchaseOrder');
        const isAttendanceRequest = detailedReport.approvable_type.includes('AttendanceRequest');

        if (isPurchaseOrder) {
            const po = approvableData;
            const totalAmount = po.items?.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0) || 0;

            return (
                <div
                    className="approvable-preview-box"
                    style={{
                        margin: '20px 0',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)'
                    }}
                >
                    <h4 style={{ marginTop: 0, borderBottom: '1px dashed var(--border)', paddingBottom: '8px', color: 'var(--text-main)' }}>
                        連動発注伝票プレビュー (発注番号: {po.order_number})
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem', marginBottom: '15px' }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>取引先: </span>
                            <strong>{po.partner?.name || '不明'}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>発注日: </span>
                            <strong>{po.order_date}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>希望納期: </span>
                            <strong>{po.delivery_deadline || '指定なし'}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>発注総額: </span>
                            <strong style={{ color: 'var(--accent-green)', fontSize: '1.1rem' }}>
                                ¥{totalAmount.toLocaleString()}
                            </strong>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '8px 5px' }}>商品名</th>
                                <th style={{ padding: '8px 5px', textAlign: 'right' }}>数量</th>
                                <th style={{ padding: '8px 5px', textAlign: 'right' }}>単価</th>
                                <th style={{ padding: '8px 5px', textAlign: 'right' }}>小計</th>
                            </tr>
                        </thead>
                        <tbody>
                            {po.items?.map((item: any) => (
                                <tr key={item.id} style={{ borderBottom: '1px dashed var(--border)' }}>
                                    <td style={{ padding: '8px 5px' }}>{item.stock?.product_name || '商品削除済'}</td>
                                    <td style={{ padding: '8px 5px', textAlign: 'right' }}>{item.quantity}</td>
                                    <td style={{ padding: '8px 5px', textAlign: 'right' }}>¥{item.unit_price.toLocaleString()}</td>
                                    <td style={{ padding: '8px 5px', textAlign: 'right' }}>¥{(item.quantity * item.unit_price).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (isAttendanceRequest) {
            const req = approvableData;
            return (
                <div
                    className="approvable-preview-box"
                    style={{
                        margin: '20px 0',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)'
                    }}
                >
                    <h4 style={{ marginTop: 0, borderBottom: '1px dashed var(--border)', paddingBottom: '8px', color: 'var(--text-main)' }}>
                        勤怠修正・休暇申請プレビュー
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.9rem' }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>申請種別: </span>
                            <strong>{req.type === 'leave' ? '休暇申請' : '打刻修正申請'}</strong>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>対象日: </span>
                            <strong>{req.target_date}</strong>
                        </div>
                        {req.type === 'leave' ? (
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>休暇種別: </span>
                                <strong className="badge badge-secondary">{req.leave_type === 'paid' ? '有給' : '無給/特別'}</strong>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>希望出勤時刻: </span>
                                    <strong>{req.requested_clock_in ? new Date(req.requested_clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>希望退勤時刻: </span>
                                    <strong>{req.requested_clock_out ? new Date(req.requested_clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '-'}</strong>
                                </div>
                            </>
                        )}
                        <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>理由: </span>
                            <div style={{ padding: '8px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                                {req.reason || '理由記載なし'}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="workflow-management-container" style={{ padding: '20px' }}>
            <div className="glass-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-main)' }}>申請・報告ダッシュボード</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
                        日報の提出や稟議、発注等に連動した決裁プロセスを回します。
                    </p>
                </div>
                {view === 'list' && (
                    <button className="btn btn-primary" onClick={handleCreateNewClick}>
                        新規申請作成
                    </button>
                )}
            </div>

            {/* Sub Navigation tabs */}
            {view === 'list' && (
                <div className="tab-menu" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                        className={`btn ${tab === 'my' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => handleTabChange('my')}
                    >
                        マイ申請
                    </button>
                    <button
                        className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => handleTabChange('pending')}
                    >
                        承認待ち申請
                    </button>
                </div>
            )}

            {/* View 1: List View */}
            {view === 'list' && (
                <div className="card" style={{ padding: '20px' }}>
                    {loadingReports ? (
                        <p>読み込み中...</p>
                    ) : reports.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                            データがありません。
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {reports.map((report) => (
                                <div
                                    key={report.id}
                                    className="list-item"
                                    onClick={() => handleViewDetail(report.id)}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '15px',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        backgroundColor: 'rgba(255,255,255,0.01)',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                            <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
                                                {report.attributes.title || report.template?.name || '無題の申請'}
                                            </strong>
                                            <span className={`badge ${report.status === 'approved' ? 'badge-success' : report.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                                {report.status === 'approved' ? '完了' :
                                                 report.status === 'rejected' ? '差し戻し/却下' :
                                                 report.status === 'draft' ? '下書き' : '承認待ち'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '15px' }}>
                                            <span>作成者: {report.user?.login_id || report.user?.email || 'システム自動'}</span>
                                            <span>作成日時: {new Date(report.created_at).toLocaleDateString()}</span>
                                            {report.status === 'pending' && (
                                                <span>現在の承認ステップ: {report.current_step} / {report.template?.steps_count}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)' }}>&gt;</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* View 2: Create View */}
            {view === 'create' && (
                <div className="card" style={{ padding: '20px', maxWidth: '800px' }}>
                    <h3>新規申請・報告の作成</h3>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>テンプレートを選択してください</label>
                        <select
                            className="input"
                            value={selectedTemplate?.id || ''}
                            onChange={(e) => handleTemplateSelect(parseInt(e.target.value))}
                            style={{ width: '100%', padding: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                        >
                            <option value="">-- テンプレートを選択 --</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedTemplate && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                            <h4 style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
                                {selectedTemplate.description || '以下のフォームに入力してください。'}
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {selectedTemplate.fields.filter(f => f.step === 1).map((field) => (
                                    <div key={field.name}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>
                                            {field.label} {field.required && <span style={{ color: 'var(--accent-red)' }}>*</span>}
                                        </label>
                                        {renderFieldInput(field)}
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleSaveReport('pending')}
                                    disabled={submitting}
                                    style={{ flex: 1 }}
                                >
                                    申請を提出する
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => handleSaveReport('draft')}
                                    disabled={submitting}
                                    style={{ flex: 1 }}
                                >
                                    下書きとして一時保存
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => setView('list')}
                                    disabled={submitting}
                                >
                                    キャンセル
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* View 3: Detail View */}
            {view === 'detail' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                    {/* Main detail card */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3>申請内容詳細</h3>
                            <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>
                                戻る
                            </button>
                        </div>

                        {loadingDetail ? (
                            <p>読み込み中...</p>
                        ) : !detailedReport ? (
                            <p>詳細データのロードに失敗しました。</p>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.4rem' }}>
                                        {detailedReport.attributes.title || detailedReport.template?.name || '無題の申請'}
                                    </h4>
                                    <span className={`badge ${detailedReport.status === 'approved' ? 'badge-success' : detailedReport.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                        {detailedReport.status === 'approved' ? '完了' :
                                         detailedReport.status === 'rejected' ? '差し戻し/却下' :
                                         detailedReport.status === 'draft' ? '下書き' : '承認待ち'}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', display: 'flex', gap: '20px' }}>
                                    <span>作成者: {detailedReport.user?.login_id || detailedReport.user?.email || '自動'}</span>
                                    <span>作成日: {new Date(detailedReport.created_at).toLocaleString()}</span>
                                    {detailedReport.status === 'pending' && (
                                        <span>ステップ: {detailedReport.current_step} / {detailedReport.template?.steps_count}</span>
                                    )}
                                </div>

                                {/* Linked app preview */}
                                {renderApprovablePreview()}

                                {/* Attributes Display */}
                                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {detailedReport.template?.fields.map(field => {
                                        const val = detailedReport.attributes[field.name];
                                        return (
                                            <div key={field.name} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                                    {field.label}
                                                </span>
                                                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>
                                                    {val !== undefined && val !== '' ? String(val) : '-'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Approver Decision Actions */}
                                {tab === 'pending' && detailedReport.status === 'pending' && (
                                    <div style={{ borderTop: '1px solid var(--border)', marginTop: '30px', paddingTop: '20px' }}>
                                        <h4>承認意思判定</h4>
                                        <div style={{ marginBottom: '15px' }}>
                                            <label style={{ display: 'block', marginBottom: '5px' }}>
                                                承認コメント/却下理由
                                            </label>
                                            <textarea
                                                className="input"
                                                value={approvalComment}
                                                onChange={(e) => setApprovalComment(e.target.value)}
                                                placeholder="承認時の申し送りや、却下/差し戻し時の理由を入力してください。"
                                                style={{ width: '100%', minHeight: '80px', padding: '10px', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleApprove}
                                                disabled={submitting}
                                                style={{ flex: 1 }}
                                            >
                                                承認する
                                            </button>
                                            <button
                                                className="btn btn-outline"
                                                style={{ color: 'var(--accent-red)', flex: 1 }}
                                                onClick={handleReject}
                                                disabled={submitting}
                                            >
                                                差し戻し/却下する
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Approval History Timeline */}
                    <div className="card" style={{ padding: '20px', height: 'fit-content' }}>
                        <h3>承認履歴・タイムライン</h3>
                        {loadingDetail ? (
                            <p>読み込み中...</p>
                        ) : !detailedReport || detailedReport.approvals?.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                判定履歴はありません。
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderLeft: '2px solid var(--border)', paddingLeft: '15px', marginLeft: '5px' }}>
                                {detailedReport?.approvals?.map((app) => (
                                    <div key={app.id} style={{ position: 'relative' }}>
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: '-24px',
                                                top: '3px',
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                backgroundColor: app.action === 'approved' ? 'var(--accent-green)' : 'var(--accent-red)',
                                                border: '3px solid var(--bg-card)'
                                            }}
                                        />
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            ステップ {app.step_number} | {new Date(app.created_at).toLocaleString()}
                                        </div>
                                        <strong style={{ fontSize: '0.95rem' }}>
                                            {app.user?.login_id || app.user?.email || '承認者'}: {app.action === 'approved' ? '承認' : '却下'}
                                        </strong>
                                        {app.comment && (
                                            <div
                                                style={{
                                                    fontSize: '0.85rem',
                                                    backgroundColor: 'rgba(0,0,0,0.1)',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    marginTop: '5px',
                                                    fontStyle: 'italic'
                                                }}
                                            >
                                                &quot;{app.comment}&quot;
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
