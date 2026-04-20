import React, { useMemo, useState, useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, CheckCircle, XCircle, Trash2, RefreshCw, Plus, X, FlaskConical, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import PracticeUserManagement from '../components/PracticeUserManagement';
import { practiceUrl, resolvePath } from '../subdomainUtils';
import { getFunctionErrorMessage } from '../supabaseFunctionError';

interface Practice {
  id: string;
  name: string;
  is_active: boolean;
  ods_code?: string;
  contact_email?: string;
  healthcheck_enabled?: boolean;
  screening_enabled?: boolean;
  immunisation_enabled?: boolean;
  ltc_enabled?: boolean;
  signed_up_at?: string;
  last_accessed?: string;
  link_visit_count?: number;
  patient_rating_count?: number;
  patient_rating_total?: number;
}

interface AdminUser {
  uid: string;
  email: string;
  name: string;
  is_active: boolean;
  role: 'owner' | 'admin';
}

type AdminRow = {
  uid: string;
  email: string;
  name: string;
  is_active: boolean;
  global_role: 'owner' | 'admin' | null;
};

interface MedicationHistoryEntry {
  id: string;
  template_key: string;
  template_id: string;
  label: string;
  version: number;
  action: 'created' | 'updated' | 'restored' | 'deleted';
  created_by: string | null;
  createdAtMs: number;
}

interface LoginAuditEntry {
  id: string;
  uid: string;
  email: string;
  actorType: 'admin' | 'practice';
  actorName: string;
  actorId?: string | null;
  adminRole?: 'owner' | 'admin' | null;
  portal: 'admin' | 'practice';
  userAgent: string;
  ipAddress: string;
  createdAtMs: number;
}

interface LoginAuditGroup {
  key: string;
  actorName: string;
  email: string;
  actorType: 'admin' | 'practice';
  portal: 'admin' | 'practice';
  adminRole?: 'owner' | 'admin' | null;
  actorId?: string | null;
  latestCreatedAtMs: number;
  latestIpAddress: string;
  latestUserAgent: string;
  entries: LoginAuditEntry[];
}

type AdminDashboardPayload = {
  practices?: Practice[];
  admins?: AdminRow[];
  medicationHistory?: Array<{
    id: string;
    template_key: string;
    template_id: string;
    label: string;
    version: number;
    action: 'created' | 'updated' | 'restored' | 'deleted';
    created_by: string | null;
    created_at?: string;
    timestamp?: string;
  }>;
  loginAudit?: Array<{
    id: string;
    uid: string;
    email: string;
    actor_type: 'admin' | 'practice';
    actor_name: string;
    actor_id?: string | null;
    admin_role?: 'owner' | 'admin' | null;
    portal: 'admin' | 'practice';
    user_agent?: string | null;
    ip_address?: string | null;
    created_at: string;
  }>;
};

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'practices' | 'practiceUsers' | 'admins' | 'setup' | 'audit'>('practices');
  const [auditTab, setAuditTab] = useState<'login' | 'medication'>('login');
  const [practices, setPractices] = useState<Practice[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [medicationHistory, setMedicationHistory] = useState<MedicationHistoryEntry[]>([]);
  const [loginAudit, setLoginAudit] = useState<LoginAuditEntry[]>([]);
  const [practiceSearch, setPracticeSearch] = useState('');
  const [practiceStatusFilter, setPracticeStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [loadingLoginAudit, setLoadingLoginAudit] = useState(true);
  const [expandedLoginAudit, setExpandedLoginAudit] = useState<Record<string, boolean>>({});
  const [authenticated, setAuthenticated] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOds, setNewOds] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addAdminError, setAddAdminError] = useState('');
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editOds, setEditOds] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHealthcheckEnabled, setEditHealthcheckEnabled] = useState(false);
  const [editScreeningEnabled, setEditScreeningEnabled] = useState(false);
  const [editImmunisationEnabled, setEditImmunisationEnabled] = useState(false);
  const [editLtcEnabled, setEditLtcEnabled] = useState(false);
  const [editError, setEditError] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminActive, setEditAdminActive] = useState(true);
  const [editAdminError, setEditAdminError] = useState('');
  const [adminActionLink, setAdminActionLink] = useState('');
  const [adminActionMessage, setAdminActionMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDangerous: boolean;
    onConfirm: () => void;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAuthenticated(true);
        loadDashboardData();
        return;
      }

      navigate(resolvePath('/admin'));
    };

    void hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setAuthenticated(true);
        loadDashboardData();
      } else {
        navigate(resolvePath('/admin'));
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    setLoadingAdmins(true);
    setLoadingAudits(true);
    setLoadingLoginAudit(true);
    setLoadError('');

    try {
      const { data, error } = await supabase.functions.invoke('list-admin-dashboard');
      if (error) throw error;

      const payload = (data || {}) as AdminDashboardPayload;
      setPractices(payload.practices || []);
      setAdminUsers(
        (payload.admins || [])
          .filter((row) => row.global_role === 'owner' || row.global_role === 'admin')
          .map((row) => ({
            uid: row.uid,
            email: row.email,
            name: row.name,
            is_active: row.is_active,
            role: row.global_role as 'owner' | 'admin',
          })),
      );
      setMedicationHistory(
        (payload.medicationHistory || []).map((row) => ({
          id: row.id,
          template_key: row.template_key,
          template_id: row.template_id,
          label: row.label,
          version: row.version,
          action: row.action,
          created_by: row.created_by,
          createdAtMs: new Date(row.created_at || row.timestamp || 0).getTime(),
        })),
      );
      setLoginAudit(
        (payload.loginAudit || []).map((row) => ({
          id: row.id,
          uid: row.uid,
          email: row.email,
          actorType: row.actor_type,
          actorName: row.actor_name,
          actorId: row.actor_id,
          adminRole: row.admin_role,
          portal: row.portal,
          userAgent: row.user_agent || '',
          ipAddress: row.ip_address || '',
          createdAtMs: new Date(row.created_at).getTime(),
        })),
      );
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      const message = await getFunctionErrorMessage(error, 'Unable to load admin dashboard data.');
      setLoadError(message);
      setPractices([]);
      setAdminUsers([]);
      setMedicationHistory([]);
      setLoginAudit([]);
    } finally {
      setLoading(false);
      setLoadingAdmins(false);
      setLoadingAudits(false);
      setLoadingLoginAudit(false);
    }
  };

  const loadAdmins = async () => {
    await loadDashboardData();
  };

  const loadAudits = async () => {
    await loadDashboardData();
  };

  const loadLoginAudit = async () => {
    await loadDashboardData();
  };

  const groupedLoginAudit = useMemo<LoginAuditGroup[]>(() => {
    const groups = new Map<string, LoginAuditGroup>();

    loginAudit.forEach((entry) => {
      const groupKey = `${entry.actorType}:${entry.portal}:${entry.email || entry.uid}`;
      const existing = groups.get(groupKey);

      if (existing) {
        existing.entries.push(entry);
        if (entry.createdAtMs > existing.latestCreatedAtMs) {
          existing.latestCreatedAtMs = entry.createdAtMs;
          existing.latestIpAddress = entry.ipAddress;
          existing.latestUserAgent = entry.userAgent;
        }
        return;
      }

      groups.set(groupKey, {
        key: groupKey,
        actorName: entry.actorName,
        email: entry.email,
        actorType: entry.actorType,
        portal: entry.portal,
        adminRole: entry.adminRole,
        actorId: entry.actorId,
        latestCreatedAtMs: entry.createdAtMs,
        latestIpAddress: entry.ipAddress,
        latestUserAgent: entry.userAgent,
        entries: [entry],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((left, right) => right.createdAtMs - left.createdAtMs),
      }))
      .sort((left, right) => right.latestCreatedAtMs - left.latestCreatedAtMs);
  }, [loginAudit]);

  const toggleLoginAuditGroup = (key: string) => {
    setExpandedLoginAudit((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleActive = async (practice: Practice) => {
    try {
      await supabase
        .from('practices')
        .update({ is_active: !practice.is_active })
        .eq('id', practice.id);
      await loadDashboardData();
    } catch (error) {
      console.error('Error updating practice:', error);
    }
  };

  const deletePractice = (practice: Practice) => {
    setConfirmDialog({
      title: 'Remove Practice',
      message: `Are you sure you want to remove "${practice.name}"? This action cannot be undone.`,
      confirmLabel: 'Remove',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await supabase.from('practices').delete().eq('id', practice.id);
          await loadDashboardData();
        } catch (error) {
          console.error('Error deleting practice:', error);
        }
        setConfirmDialog(null);
      },
    });
  };

  const resetPracticeCounters = (practice: Practice) => {
    setConfirmDialog({
      title: 'Reset Practice Counters',
      message: `Reset patient link usage and satisfaction scores for "${practice.name}"? This will clear usage count, rating count, rating total, and last accessed date.`,
      confirmLabel: 'Reset Counters',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await supabase.from('practices').update({
            link_visit_count: 0,
            patient_rating_count: 0,
            patient_rating_total: 0,
            last_accessed: null,
            updated_at: new Date().toISOString(),
          }).eq('id', practice.id);
          await loadDashboardData();
        } catch (error) {
          console.error('Error resetting counters:', error);
        }
        setConfirmDialog(null);
      },
    });
  };

  const getPracticeSatisfaction = (practice: Practice) => {
    const count = practice.patient_rating_count ?? 0;
    const total = practice.patient_rating_total ?? 0;
    if (count <= 0) {
      return 'No ratings';
    }

    return `${(total / count).toFixed(1)}/5 (${count})`;
  };

  const addPractice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!newName.trim()) {
      setAddError('Organisation name is required');
      return;
    }

    if (!newEmail.trim()) {
      setAddError('Contact email is required');
      return;
    }

    // TODO: Uncomment for production - restrict to nhs.net only
    // if (!newEmail.trim().toLowerCase().endsWith('@nhs.net')) {
    //   setAddError('Only nhs.net email addresses are accepted');
    //   return;
    // }

    try {
      // 1. Create the practice document
      const { error: insertError } = await supabase
        .from('practices')
        .insert({
          name: newName.trim(),
          ods_code: newOds.trim().toUpperCase(),
          contact_email: newEmail.trim(),
          is_active: true,
          link_visit_count: 0,
        });

      if (insertError) throw insertError;

      setNewName('');
      setNewOds('');
      setNewEmail('');
      setShowAddForm(false);
      await loadDashboardData();
    } catch (error) {
      console.error('Error adding practice:', error);
      setAddError('Failed to add practice. Please try again.');
    }
  };

  const openEditForm = (practice: Practice) => {
    setEditingPractice(practice);
    setEditName(practice.name);
    setEditOds(practice.ods_code || '');
    setEditEmail(practice.contact_email || '');
    setEditHealthcheckEnabled(practice.healthcheck_enabled === true);
    setEditScreeningEnabled(practice.screening_enabled === true);
    setEditImmunisationEnabled(practice.immunisation_enabled === true);
    setEditLtcEnabled(practice.ltc_enabled === true);
    setEditError('');
  };

  const savePracticeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editingPractice) return;

    if (!editName.trim()) {
      setEditError('Organisation name is required');
      return;
    }

    if (!editEmail.trim()) {
      setEditError('Contact email is required');
      return;
    }

    try {
      await supabase.from('practices').update({
        name: editName.trim(),
        ods_code: editOds.trim().toUpperCase(),
        contact_email: editEmail.trim(),
        healthcheck_enabled: editHealthcheckEnabled,
        screening_enabled: editScreeningEnabled,
        immunisation_enabled: editImmunisationEnabled,
        ltc_enabled: editLtcEnabled,
      }).eq('id', editingPractice.id);

      setEditingPractice(null);
      await loadDashboardData();
    } catch (error) {
      console.error('Error updating practice:', error);
      setEditError('Failed to update practice. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(resolvePath('/admin'));
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminError('');
    setAdminActionLink('');
    setAdminActionMessage('');

    if (!newAdminEmail.trim()) {
      setAddAdminError('Administrator email is required');
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-admin-user', {
        body: { email: newAdminEmail.trim(), name: newAdminName.trim() },
      });
      if (invokeError) throw invokeError;
      const nextEmail = newAdminEmail.trim();
      setNewAdminName('');
      setNewAdminEmail('');
      setShowAddAdminForm(false);
      setAdminActionMessage(
        data?.created === false
          ? `Global administrator access added for ${nextEmail}. Any existing practice memberships remain in place.`
          : `Administrator created. Copy the setup link below and send it to ${nextEmail}.`,
      );
      setAdminActionLink(data?.resetLink || '');
      loadAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      setAddAdminError(await getFunctionErrorMessage(error, 'Failed to add administrator'));
    }
  };

  const openAdminEditForm = (adminUser: AdminUser) => {
    setEditingAdmin(adminUser);
    setEditAdminName(adminUser.name);
    setEditAdminEmail(adminUser.email);
    setEditAdminActive(adminUser.is_active);
    setEditAdminError('');
  };

  const saveAdminEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditAdminError('');

    if (!editingAdmin) return;

    try {
      const { error: invokeError } = await supabase.functions.invoke('update-admin-user', {
        body: {
          uid: editingAdmin.uid,
          email: editAdminEmail.trim(),
          name: editAdminName.trim(),
          isActive: editAdminActive,
        },
      });
      if (invokeError) throw invokeError;
      setEditingAdmin(null);
      loadAdmins();
    } catch (error) {
      console.error('Error updating admin:', error);
      setEditAdminError(await getFunctionErrorMessage(error, 'Failed to update administrator'));
    }
  };

  const resetAdminPassword = async (adminUser: AdminUser) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-admin-password-reset', {
        body: { uid: adminUser.uid },
      });
      if (invokeError) throw invokeError;
      setAdminActionMessage(`Password reset link prepared for ${adminUser.email}. Copy and send it manually.`);
      setAdminActionLink(data.resetLink || '');
    } catch (error) {
      console.error('Error sending reset:', error);
      alert(await getFunctionErrorMessage(error, 'Failed to send password reset'));
    }
  };

  const deleteAdmin = (adminUser: AdminUser) => {
    setConfirmDialog({
      title: 'Remove Administrator',
      message: `Remove administrator "${adminUser.email}"? This action cannot be undone.`,
      confirmLabel: 'Remove',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const { data, error: invokeError } = await supabase.functions.invoke('delete-admin-user', {
            body: { uid: adminUser.uid },
          });
          if (invokeError) throw invokeError;
          setAdminActionMessage(
            data?.demotedOnly
              ? `${adminUser.email} still has practice access, so only their global administrator role was removed.`
              : `${adminUser.email} was deleted completely.`,
          );
          setAdminActionLink('');
          loadAdmins();
        } catch (error) {
          console.error('Error deleting admin:', error);
          alert(await getFunctionErrorMessage(error, 'Failed to remove administrator'));
        }
        setConfirmDialog(null);
      },
    });
  };

  if (!authenticated) return null;

  return (
    <>
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDangerous={confirmDialog.isDangerous}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div className="dashboard-header-copy">
          <h1>
            <ShieldAlert size={22} color="#005eb8" /> Admin Dashboard
          </h1>
          <p>Manage practices, users, administrators, and patient-facing outputs from one place.</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={() => navigate(resolvePath('/admin/card-builder'))} className="action-button" style={{ backgroundColor: '#005eb8' }}>
            <FlaskConical size={16} /> Card Builder
          </button>
          <button onClick={loadDashboardData} className="action-button" style={{ backgroundColor: '#4c6272' }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleSignOut} className="action-button" style={{ backgroundColor: '#d5281b' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button className={`dashboard-tab${activeTab === 'practices' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('practices')}>
          Practices
        </button>
        <button className={`dashboard-tab${activeTab === 'practiceUsers' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('practiceUsers')}>
          Users
        </button>
        <button className={`dashboard-tab${activeTab === 'admins' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('admins')}>
          Administrators
        </button>
        <button className={`dashboard-tab${activeTab === 'setup' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('setup')}>
          Setup
        </button>
        <button className={`dashboard-tab${activeTab === 'audit' ? ' dashboard-tab--active' : ''}`} onClick={() => setActiveTab('audit')}>
          Audit Log
        </button>
      </div>

      {loadError && (
        <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
          {loadError}
        </div>
      )}

      {(adminActionMessage || adminActionLink) && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <h2 className="dashboard-panel-title">Access Link Ready</h2>
          {adminActionMessage && (
            <p className="dashboard-panel-subtitle" style={{ marginBottom: adminActionLink ? '1rem' : '0' }}>
              {adminActionMessage}
            </p>
          )}
          {adminActionLink && (
            <>
              <textarea
                readOnly
                value={adminActionLink}
                rows={4}
                style={{ width: '100%', resize: 'vertical' }}
                className="dashboard-field"
              />
              <div className="dashboard-inline-actions" style={{ marginTop: '1rem' }}>
                <button
                  onClick={() => navigator.clipboard.writeText(adminActionLink)}
                  className="action-button"
                  style={{ backgroundColor: '#005eb8' }}
                >
                  Copy Link
                </button>
                <button
                  onClick={() => {
                    setAdminActionLink('');
                    setAdminActionMessage('');
                  }}
                  className="action-button"
                  style={{ backgroundColor: '#4c6272' }}
                >
                  Clear
                </button>
              </div>
            </>
          )}
          {!adminActionLink && (
            <div className="dashboard-inline-actions" style={{ marginTop: '1rem' }}>
              <button
                onClick={() => {
                  setAdminActionLink('');
                  setAdminActionMessage('');
                }}
                className="action-button"
                style={{ backgroundColor: '#4c6272' }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {showAddForm && activeTab === 'practices' && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">Add Practice</h2>
            <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {addError && (
            <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
              {addError}
            </div>
          )}
          <form onSubmit={addPractice} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="dashboard-field">
              <label>Organisation Name *</label>
              <input
                type="text" value={newName} onChange={e => setNewName(e.target.value)} required
                placeholder="Exact name as in SystmOne"
              />
            </div>
            <div className="dashboard-form-grid">
              <div className="dashboard-field">
                <label>ODS Code</label>
                <input
                  type="text" value={newOds} onChange={e => setNewOds(e.target.value)}
                  placeholder="e.g. C84001"
                />
              </div>
              <div className="dashboard-field">
                <label>Contact Email *</label>
                <input
                  type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                  placeholder="e.g. practice.manager@nhs.net"
                />
              </div>
            </div>
            <button type="submit" className="action-button" style={{ alignSelf: 'flex-start' }}>
              <Plus size={16} /> Add Practice
            </button>
          </form>
        </div>
      )}

      {showAddAdminForm && activeTab === 'admins' && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">Add Administrator</h2>
            <button onClick={() => setShowAddAdminForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              <X size={20} />
            </button>
          </div>
          {addAdminError && (
            <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
              {addAdminError}
            </div>
          )}
          <form onSubmit={addAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="dashboard-field">
              <label>Administrator Name</label>
              <input
                type="text" value={newAdminName} onChange={e => setNewAdminName(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="dashboard-field">
              <label>Administrator Email *</label>
              <input
                type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required
                placeholder="e.g. admin@nhs.net"
              />
            </div>
            <button type="submit" className="action-button" style={{ alignSelf: 'flex-start' }}>
              <Plus size={16} /> Add Administrator
            </button>
          </form>
        </div>
      )}

      {editingPractice && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 999 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: 'white', borderRadius: '8px', width: '90%', maxWidth: '500px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1a1a1a' }}>Edit Practice</h2>
              <button onClick={() => setEditingPractice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272', padding: '0.5rem' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {editError && (
                <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
                  {editError}
                </div>
              )}
              <form onSubmit={savePracticeEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} id="edit-practice-form">
                <div className="dashboard-field">
                  <label>Organisation Name *</label>
                  <input
                    type="text" value={editName} onChange={e => setEditName(e.target.value)} required
                    placeholder="Exact name as in SystmOne"
                  />
                </div>
                <div className="dashboard-form-grid">
                  <div className="dashboard-field">
                    <label>ODS Code</label>
                    <input
                      type="text" value={editOds} onChange={e => setEditOds(e.target.value)}
                      placeholder="e.g. C84001"
                    />
                  </div>
                  <div className="dashboard-field">
                    <label>Contact Email *</label>
                    <input
                      type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required
                      placeholder="e.g. admin@nhs.net"
                    />
                  </div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #d8dde0', background: '#f8fbfd' }}>
                  <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: '#1a1a1a' }}>Patient Information Functions</h3>
                  <p style={{ margin: '0 0 0.9rem', color: '#4c6272', fontSize: '0.92rem' }}>
                    These shared card sets are controlled by administrators and stay off until enabled here for the practice.
                  </p>
                  <div style={{ display: 'grid', gap: '0.7rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, color: '#1a1a1a' }}>
                      <input type="checkbox" checked={editHealthcheckEnabled} onChange={(e) => setEditHealthcheckEnabled(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      Enable Health Checks
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, color: '#1a1a1a' }}>
                      <input type="checkbox" checked={editScreeningEnabled} onChange={(e) => setEditScreeningEnabled(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      Enable Screening
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, color: '#1a1a1a' }}>
                      <input type="checkbox" checked={editImmunisationEnabled} onChange={(e) => setEditImmunisationEnabled(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      Enable Immunisations
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, color: '#1a1a1a' }}>
                      <input type="checkbox" checked={editLtcEnabled} onChange={(e) => setEditLtcEnabled(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                      Enable Long Term Conditions
                    </label>
                  </div>
                </div>
              </form>
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingPractice(null)} style={{
                padding: '0.75rem 1.5rem', backgroundColor: '#4c6272', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500
              }}>
                Cancel
              </button>
              <button type="submit" form="edit-practice-form" style={{
                padding: '0.75rem 1.5rem', backgroundColor: '#007f3b', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500
              }}>
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}

      {editingAdmin && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 999 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            backgroundColor: 'white', borderRadius: '8px', width: '90%', maxWidth: '500px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e0e0e0' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1a1a1a' }}>Edit Administrator</h2>
              <button onClick={() => setEditingAdmin(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272', padding: '0.5rem' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {editAdminError && (
                <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
                  {editAdminError}
                </div>
              )}
              <form onSubmit={saveAdminEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} id="edit-admin-form">
                <div className="dashboard-field">
                  <label>Administrator Name *</label>
                  <input
                    type="text" value={editAdminName} onChange={e => setEditAdminName(e.target.value)} required
                  />
                </div>
                <div className="dashboard-field">
                  <label>Administrator Email *</label>
                  <input
                    type="email" value={editAdminEmail} onChange={e => setEditAdminEmail(e.target.value)} required
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={editAdminActive}
                    onChange={e => setEditAdminActive(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Administrator account active
                </label>
              </form>
            </div>
            <div style={{ padding: '1.5rem', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingAdmin(null)} style={{
                padding: '0.75rem 1.5rem', backgroundColor: '#4c6272', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500
              }}>
                Cancel
              </button>
              <button type="submit" form="edit-admin-form" style={{
                padding: '0.75rem 1.5rem', backgroundColor: '#007f3b', color: 'white',
                border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500
              }}>
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'practiceUsers' && (
      <>
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <h2 className="dashboard-panel-title">User Management</h2>
          <p className="dashboard-panel-subtitle">
            Users can be practice admins, global admins, or both. Practice-linked users can belong to multiple practices, and global medication changes go live immediately for practices using the global source.
          </p>
        </div>
        <PracticeUserManagement practices={practices} />
      </>
      )}

      {activeTab === 'admins' && (
      <div className="dashboard-panel dashboard-section">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">
            Administrator Accounts ({adminUsers.length})
            </h2>
            <p className="dashboard-panel-subtitle">Manage global administrator access on top of the shared user account model.</p>
          </div>
          {!showAddAdminForm && (
            <button onClick={() => setShowAddAdminForm(true)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Plus size={16} /> Add Administrator
            </button>
          )}
        </div>

        {loadingAdmins ? (
          <p style={{ color: '#4c6272' }}>Loading administrators...</p>
        ) : adminUsers.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No administrator accounts found yet.</p>
        ) : (
          <div className="dashboard-list">
            {adminUsers.map((adminUser) => (
              <div
                key={adminUser.uid}
                className="dashboard-list-card"
              >
                <div className="dashboard-list-main">
                  <div className="dashboard-list-title">{adminUser.name}</div>
                  <div className="dashboard-meta">
                    <span>{adminUser.email}</span>
                    <span className={`dashboard-badge ${adminUser.is_active ? 'dashboard-badge--green' : 'dashboard-badge--red'}`}>
                      {adminUser.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span className={`dashboard-badge ${adminUser.role === 'owner' ? 'dashboard-badge--amber' : 'dashboard-badge--blue'}`}>
                      {adminUser.role.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="dashboard-list-actions">
                  <button onClick={() => openAdminEditForm(adminUser)} className="dashboard-pill-button dashboard-pill-button--muted">
                    <Edit2 size={16} /> Edit
                  </button>
                  <button onClick={() => resetAdminPassword(adminUser)} className="dashboard-pill-button dashboard-pill-button--primary">
                    <RefreshCw size={16} /> Reset Password
                  </button>
                  {adminUser.role !== 'owner' && (
                    <button onClick={() => deleteAdmin(adminUser)} className="dashboard-pill-button dashboard-pill-button--danger">
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {activeTab === 'practices' && (
      <div className="dashboard-panel dashboard-section">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">
            Registered Practices ({practices.length})
            </h2>
            <p className="dashboard-panel-subtitle">Control which practices can use the service and keep their setup details up to date.</p>
          </div>
          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} className="action-button" style={{ backgroundColor: '#007f3b' }}>
              <Plus size={16} /> Add Practice
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: '#4c6272' }}>Loading practices...</p>
        ) : practices.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No practices registered yet. Share the sign-up link with practices.</p>
        ) : (
          <>
            <div className="dashboard-toolbar" style={{ marginBottom: '1rem' }}>
              <div className="dashboard-search">
                <input
                  type="text"
                  value={practiceSearch}
                  onChange={(e) => setPracticeSearch(e.target.value)}
                  placeholder="Search by name, ODS code, or email"
                  style={{ width: '100%', padding: '0.75rem 0.9rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem' }}
                />
              </div>
              <div className="dashboard-chip-row">
                <button
                  className={`dashboard-chip${practiceStatusFilter === 'all' ? ' dashboard-chip--active' : ''}`}
                  onClick={() => setPracticeStatusFilter('all')}
                >
                  All
                </button>
                <button
                  className={`dashboard-chip${practiceStatusFilter === 'active' ? ' dashboard-chip--active' : ''}`}
                  onClick={() => setPracticeStatusFilter('active')}
                >
                  Active
                </button>
                <button
                  className={`dashboard-chip${practiceStatusFilter === 'inactive' ? ' dashboard-chip--active' : ''}`}
                  onClick={() => setPracticeStatusFilter('inactive')}
                >
                  Inactive
                </button>
              </div>
            </div>
            <div className="dashboard-list">
              {practices
                .filter(p => {
                  const matchesSearch = practiceSearch === '' || [p.name, p.ods_code || '', p.contact_email || ''].some(field =>
                    field.toLowerCase().includes(practiceSearch.toLowerCase())
                  );
                  const matchesStatus = practiceStatusFilter === 'all' || (practiceStatusFilter === 'active' ? p.is_active : !p.is_active);
                  return matchesSearch && matchesStatus;
                })
                .map(practice => (
              <div
                key={practice.id}
                className="dashboard-list-card"
                style={{ background: practice.is_active ? '#f0f9f0' : '#fef7f0' }}
              >
                <div className="dashboard-list-main">
                  <div className="dashboard-list-title">{practice.name}</div>
                <div className="dashboard-meta">
                  {practice.ods_code && <span>ODS: {practice.ods_code}</span>}
                  {practice.contact_email && <span>{practice.contact_email}</span>}
                  <span>Patient link uses: {practice.link_visit_count ?? 0}</span>
                  <span>Satisfaction: {getPracticeSatisfaction(practice)}</span>
                  {practice.last_accessed && (
                    <span>Last active: {new Date(practice.last_accessed).toLocaleDateString() || 'N/A'}</span>
                  )}
                </div>
                <div className="dashboard-chip-row" style={{ marginTop: '0.6rem' }}>
                  <span className={`dashboard-badge ${practice.healthcheck_enabled ? 'dashboard-badge--green' : 'dashboard-badge--muted'}`}>Health checks {practice.healthcheck_enabled ? 'on' : 'off'}</span>
                  <span className={`dashboard-badge ${practice.screening_enabled ? 'dashboard-badge--green' : 'dashboard-badge--muted'}`}>Screening {practice.screening_enabled ? 'on' : 'off'}</span>
                  <span className={`dashboard-badge ${practice.immunisation_enabled ? 'dashboard-badge--green' : 'dashboard-badge--muted'}`}>Immunisations {practice.immunisation_enabled ? 'on' : 'off'}</span>
                  <span className={`dashboard-badge ${practice.ltc_enabled ? 'dashboard-badge--green' : 'dashboard-badge--muted'}`}>LTC {practice.ltc_enabled ? 'on' : 'off'}</span>
                </div>
              </div>
                <div className="dashboard-list-actions">
                  {practice.is_active ? (
                    <span className="dashboard-badge dashboard-badge--green">
                      <CheckCircle size={16} /> Active
                    </span>
                  ) : (
                    <span className="dashboard-badge dashboard-badge--red">
                      <XCircle size={16} /> Inactive
                    </span>
                  )}
                  <button onClick={() => openEditForm(practice)} className="dashboard-pill-button dashboard-pill-button--primary">
                    <Edit2 size={14} /> Edit
                  </button>
                  <button onClick={() => toggleActive(practice)} className={`dashboard-pill-button ${practice.is_active ? 'dashboard-pill-button--danger' : 'dashboard-pill-button--success'}`}>
                    {practice.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => resetPracticeCounters(practice)} className="dashboard-pill-button dashboard-pill-button--muted">
                    <RefreshCw size={14} /> Reset Counters
                  </button>
                  <button onClick={() => deletePractice(practice)} className="dashboard-pill-button dashboard-pill-button--muted">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
        )}
      </div>
      )}

      {activeTab === 'setup' && (
      <div className="dashboard-panel dashboard-section">
        <h2 className="dashboard-panel-title">Practice Sign-up Link</h2>
        <p className="dashboard-panel-subtitle" style={{ marginBottom: '1rem' }}>
          Share this link with practices that want to register:
        </p>
        <div style={{
          padding: '0.75rem 1rem', background: '#eef7ff', borderRadius: '8px',
          fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all',
          border: '1px solid #005eb8'
        }}>
          {practiceUrl('/signup')}
        </div>
        <div className="dashboard-banner dashboard-banner--info" style={{ marginTop: '1rem' }}>
          Use the Users tab to create accounts, assign users to multiple practices, and send reset links after accounts are created.
        </div>
      </div>
      )}

      {activeTab === 'audit' && (
      <>
      <div className="dashboard-tabs" style={{ marginBottom: '1rem' }}>
          <button
            className={`dashboard-tab${auditTab === 'login' ? ' dashboard-tab--active' : ''}`}
            onClick={() => setAuditTab('login')}
          >
            Login Audit
          </button>
          <button
            className={`dashboard-tab${auditTab === 'medication' ? ' dashboard-tab--active' : ''}`}
            onClick={() => setAuditTab('medication')}
          >
            Medication History
          </button>
        </div>

        {auditTab === 'login' && (
        <div className="dashboard-panel dashboard-section">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">
              Recent Login Audit ({groupedLoginAudit.length})
              </h2>
              <p className="dashboard-panel-subtitle">Successful sign-ins grouped by user so repeated logins stay tidy.</p>
            </div>
            <button onClick={loadLoginAudit} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <RefreshCw size={16} /> Refresh Logins
            </button>
          </div>

          <div className="dashboard-banner dashboard-banner--info" style={{ marginBottom: '1rem' }}>
            Failed sign-in attempts are not captured here because the password check is handled directly by Firebase Auth.
          </div>

          {loadingLoginAudit ? (
            <p style={{ color: '#4c6272' }}>Loading login audit...</p>
          ) : groupedLoginAudit.length === 0 ? (
            <p style={{ color: '#4c6272' }}>No successful sign-ins recorded yet.</p>
          ) : (
            <div className="dashboard-list" style={{ marginBottom: '1rem' }}>
              {groupedLoginAudit.map((group) => {
                const isExpanded = Boolean(expandedLoginAudit[group.key]);

                return (
                  <div key={group.key} className="dashboard-list-card">
                    <div className="dashboard-list-main">
                      <div className="dashboard-panel-header" style={{ gap: '1rem', alignItems: 'flex-start' }}>
                        <div>
                          <div className="dashboard-list-title">{group.actorName}</div>
                          <div className="dashboard-meta">
                            <span>{group.email}</span>
                            <span className={`dashboard-badge ${group.actorType === 'admin' ? 'dashboard-badge--blue' : 'dashboard-badge--green'}`}>
                              {group.actorType.toUpperCase()}
                            </span>
                            <span className="dashboard-badge dashboard-badge--amber">{group.portal.toUpperCase()} PORTAL</span>
                            {group.adminRole && (
                              <span className="dashboard-badge dashboard-badge--muted">{group.adminRole.toUpperCase()}</span>
                            )}
                            <span>{group.entries.length} login{group.entries.length === 1 ? '' : 's'}</span>
                            <span>Last: {new Date(group.latestCreatedAtMs).toLocaleString('en-GB')}</span>
                          </div>
                          <div className="dashboard-meta" style={{ marginTop: '0.35rem' }}>
                            <span>Latest IP: {group.latestIpAddress || 'Unavailable'}</span>
                            <span title={group.latestUserAgent}>Latest browser: {group.latestUserAgent ? group.latestUserAgent.slice(0, 90) : 'Unavailable'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleLoginAuditGroup(group.key)}
                          className="dashboard-pill-button dashboard-pill-button--muted"
                          style={{ flexShrink: 0 }}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          {isExpanded ? 'Hide history' : 'View history'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="dashboard-audit-history">
                          {group.entries.map((entry, index) => (
                            <div key={entry.id} className="dashboard-audit-history-row">
                              <div className="dashboard-meta" style={{ margin: 0 }}>
                                <span>{index === 0 ? 'Latest login' : `Previous login ${index}`}</span>
                                <span>{new Date(entry.createdAtMs).toLocaleString('en-GB')}</span>
                                <span>IP: {entry.ipAddress || 'Unavailable'}</span>
                              </div>
                              <div className="dashboard-meta" style={{ marginTop: '0.25rem' }}>
                                <span title={entry.userAgent}>Browser: {entry.userAgent || 'Unavailable'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {auditTab === 'medication' && (
        <div className="dashboard-panel dashboard-section">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="dashboard-panel-title">
              Medication History ({medicationHistory.length})
              </h2>
              <p className="dashboard-panel-subtitle">Shared revision history for medication cards.</p>
            </div>
            <button onClick={loadAudits} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {loadingAudits ? (
            <p style={{ color: '#4c6272' }}>Loading medication history...</p>
          ) : medicationHistory.length === 0 ? (
            <p style={{ color: '#4c6272' }}>No medication history found.</p>
          ) : (
            <div className="dashboard-list">
              {medicationHistory.map((entry) => {
                const actorEmail = adminUsers.find((admin) => admin.uid === entry.created_by)?.email || entry.created_by || 'Unknown';
                const dateObj = new Date(entry.createdAtMs);
                const isDeleted = entry.action === 'deleted';
                const isCreated = entry.action === 'created';

                return (
                <div
                  key={entry.id}
                  className="dashboard-list-card"
                >
                  <div style={{
                    padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem',
                    fontWeight: 800, fontFamily: 'monospace', background: isDeleted ? '#d5281b' : (isCreated ? '#007f3b' : '#005eb8'), color: 'white',
                    minWidth: '40px', textAlign: 'center',
                  }}>
                    {entry.template_id || '???'}
                  </div>
                  <div className="dashboard-list-main" style={{ marginLeft: '1rem' }}>
                    <div className="dashboard-list-title">{entry.label}</div>
                    <div className="dashboard-meta" style={{ marginTop: '0.25rem' }}>
                      <span style={{
                        fontWeight: 700,
                        color: isDeleted ? '#d5281b' : (isCreated ? '#007f3b' : '#005eb8')
                      }}>
                        v{entry.version} · {entry.action.toUpperCase()}
                      </span>
                      <span>by {actorEmail}</span>
                      <span>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
        )}
      </>
      )}
    </div>
    </>
  );
};

export default AdminDashboard;
