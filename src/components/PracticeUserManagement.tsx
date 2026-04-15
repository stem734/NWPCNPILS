import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Mail, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import ConfirmDialog from './ConfirmDialog';
import type { PracticeSummary, PracticeUserSummary } from '../practicePortal';

type PracticeUserManagementProps = {
  practices: PracticeSummary[];
};

type PracticeUserRow = {
  uid: string;
  email: string;
  name: string;
  is_active: boolean;
  memberships: Array<{
    id: string;
    practice_id: string;
    user_uid: string;
    role: 'editor';
    is_default: boolean;
    practice: Pick<PracticeSummary, 'id' | 'name' | 'is_active'> | Array<Pick<PracticeSummary, 'id' | 'name' | 'is_active'>> | null;
  }>;
};

type PracticeUserFormState = {
  uid?: string;
  name: string;
  email: string;
  isActive: boolean;
  practiceIds: string[];
  defaultPracticeId: string;
};

const emptyForm = (): PracticeUserFormState => ({
  name: '',
  email: '',
  isActive: true,
  practiceIds: [],
  defaultPracticeId: '',
});

const normalisePractice = (
  value: PracticeUserRow['memberships'][number]['practice'],
): Pick<PracticeSummary, 'id' | 'name' | 'is_active'> | null => {
  const practice = Array.isArray(value) ? value[0] : value;
  return practice ?? null;
};

const PracticeUserManagement: React.FC<PracticeUserManagementProps> = ({ practices }) => {
  const [practiceUsers, setPracticeUsers] = useState<PracticeUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<PracticeUserSummary | null>(null);
  const [form, setForm] = useState<PracticeUserFormState>(emptyForm());
  const [error, setError] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDangerous: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    void loadPracticeUsers();
  }, []);

  const activePractices = useMemo(
    () => [...practices].sort((left, right) => left.name.localeCompare(right.name)),
    [practices],
  );

  const loadPracticeUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: practiceUserError } = await supabase
        .from('practice_users')
        .select(`
          uid,
          email,
          name,
          is_active,
          memberships:practice_memberships(
            id,
            practice_id,
            user_uid,
            role,
            is_default,
            practice:practices(
              id,
              name,
              is_active
            )
          )
        `)
        .order('email');

      if (practiceUserError) {
        throw practiceUserError;
      }

      const mappedUsers = (((data || []) as unknown) as PracticeUserRow[]).map((row) => ({
        uid: row.uid,
        email: row.email,
        name: row.name,
        is_active: row.is_active,
        memberships: (row.memberships || [])
          .flatMap((membership) => {
            const practice = normalisePractice(membership.practice);
            if (!practice) {
              return [];
            }

            return [{
              ...membership,
              practice,
            }];
          })
          .sort((left, right) => Number(right.is_default) - Number(left.is_default) || left.practice.name.localeCompare(right.practice.name)),
      }));

      setPracticeUsers(mappedUsers);
    } catch (err) {
      console.error('Error loading practice users:', err);
      setError('Unable to load practice users.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm());
    setShowAddForm(false);
    setEditingUser(null);
    setError('');
  };

  const openAddForm = () => {
    setForm({
      ...emptyForm(),
      practiceIds: activePractices[0] ? [activePractices[0].id] : [],
      defaultPracticeId: activePractices[0]?.id || '',
    });
    setShowAddForm(true);
    setEditingUser(null);
    setError('');
  };

  const openEditForm = (practiceUser: PracticeUserSummary) => {
    setEditingUser(practiceUser);
    setShowAddForm(false);
    setError('');
    setForm({
      uid: practiceUser.uid,
      name: practiceUser.name,
      email: practiceUser.email,
      isActive: practiceUser.is_active,
      practiceIds: practiceUser.memberships.map((membership) => membership.practice_id),
      defaultPracticeId:
        practiceUser.memberships.find((membership) => membership.is_default)?.practice_id ||
        practiceUser.memberships[0]?.practice_id ||
        '',
    });
  };

  const togglePracticeId = (practiceId: string) => {
    setForm((current) => {
      const exists = current.practiceIds.includes(practiceId);
      const practiceIds = exists
        ? current.practiceIds.filter((value) => value !== practiceId)
        : [...current.practiceIds, practiceId];

      return {
        ...current,
        practiceIds,
        defaultPracticeId:
          practiceIds.includes(current.defaultPracticeId)
            ? current.defaultPracticeId
            : practiceIds[0] || '',
      };
    });
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setActionLink('');
    setActionMessage('');

    if (!form.email.trim()) {
      setError('Practice user email is required');
      return;
    }

    if (form.practiceIds.length === 0) {
      setError('Select at least one practice');
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('upsert-practice-user', {
        body: {
          email: form.email.trim(),
          name: form.name.trim(),
          practiceIds: form.practiceIds,
          defaultPracticeId: form.defaultPracticeId,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data?.resetLink) {
        setActionLink(data.resetLink);
        setActionMessage(`Practice user created. Copy the setup link below and send it to ${form.email.trim()}.`);
      } else {
        setActionMessage(`Existing practice user updated with access to ${form.practiceIds.length} practice${form.practiceIds.length === 1 ? '' : 's'}.`);
      }

      resetForm();
      await loadPracticeUsers();
    } catch (err) {
      console.error('Error creating practice user:', err);
      setError(err instanceof Error ? err.message : 'Unable to save practice user.');
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.uid) return;
    if (!form.email.trim()) {
      setError('Practice user email is required');
      return;
    }

    if (form.practiceIds.length === 0) {
      setError('Select at least one practice');
      return;
    }

    try {
      const { error: invokeError } = await supabase.functions.invoke('update-practice-user', {
        body: {
          uid: form.uid,
          email: form.email.trim(),
          name: form.name.trim(),
          isActive: form.isActive,
          practiceIds: form.practiceIds,
          defaultPracticeId: form.defaultPracticeId,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      setActionMessage(`Practice user ${form.email.trim()} updated successfully.`);
      setActionLink('');
      resetForm();
      await loadPracticeUsers();
    } catch (err) {
      console.error('Error updating practice user:', err);
      setError(err instanceof Error ? err.message : 'Unable to update practice user.');
    }
  };

  const sendPasswordReset = async (practiceUser: PracticeUserSummary) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-practice-password-reset', {
        body: { uid: practiceUser.uid },
      });

      if (invokeError) {
        throw invokeError;
      }

      setActionMessage(`Password reset link prepared for ${practiceUser.email}. Copy and send it manually if needed.`);
      setActionLink(data?.resetLink || '');
    } catch (err) {
      console.error('Error sending practice password reset:', err);
      setError(err instanceof Error ? err.message : 'Unable to send password reset.');
    }
  };

  const deletePracticeUser = (practiceUser: PracticeUserSummary) => {
    setConfirmDialog({
      title: 'Delete Practice User',
      message: `Delete ${practiceUser.email}? This removes all practice memberships and deletes the underlying auth account.`,
      confirmLabel: 'Delete User',
      isDangerous: true,
      onConfirm: () => {
        void (async () => {
          try {
            const { error: invokeError } = await supabase.functions.invoke('delete-practice-user', {
              body: { uid: practiceUser.uid },
            });

            if (invokeError) {
              throw invokeError;
            }

            setActionMessage(`Practice user ${practiceUser.email} deleted.`);
            setActionLink('');
            await loadPracticeUsers();
          } catch (err) {
            console.error('Error deleting practice user:', err);
            setError(err instanceof Error ? err.message : 'Unable to delete practice user.');
          } finally {
            setConfirmDialog(null);
          }
        })();
      },
    });
  };

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

      {(actionMessage || actionLink) && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <h2 className="dashboard-panel-title">Practice User Action</h2>
          {actionMessage && <p className="dashboard-panel-subtitle" style={{ marginBottom: '1rem' }}>{actionMessage}</p>}
          {actionLink && (
            <>
              <textarea readOnly value={actionLink} rows={4} style={{ width: '100%', resize: 'vertical' }} className="dashboard-field" />
              <div className="dashboard-inline-actions" style={{ marginTop: '1rem' }}>
                <button onClick={() => navigator.clipboard.writeText(actionLink)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
                  <Mail size={16} /> Copy Link
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(showAddForm || editingUser) && (
        <div className="dashboard-panel dashboard-section" style={{ borderLeft: '4px solid #005eb8' }}>
          <div className="dashboard-panel-header">
            <h2 className="dashboard-panel-title">{editingUser ? 'Edit Practice User' : 'Add Practice User'}</h2>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272' }}>
              Cancel
            </button>
          </div>

          {error && (
            <div className="dashboard-banner dashboard-banner--error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={editingUser ? handleUpdate : handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="dashboard-form-grid">
              <div className="dashboard-field">
                <label>Name</label>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="dashboard-field">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              Practice user account active
            </label>

            <div className="dashboard-panel" style={{ background: '#f8fafb' }}>
              <h3 className="dashboard-panel-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Assigned Practices</h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {activePractices.map((practice) => (
                  <label key={practice.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={form.practiceIds.includes(practice.id)}
                      onChange={() => togglePracticeId(practice.id)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>{practice.name}{practice.is_active ? '' : ' (Inactive)'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="dashboard-field" style={{ maxWidth: '420px' }}>
              <label>Default Practice</label>
              <select
                value={form.defaultPracticeId}
                onChange={(event) => setForm((current) => ({ ...current, defaultPracticeId: event.target.value }))}
                disabled={form.practiceIds.length === 0}
              >
                {form.practiceIds.map((practiceId) => {
                  const practice = activePractices.find((item) => item.id === practiceId);
                  if (!practice) return null;

                  return (
                    <option key={practice.id} value={practice.id}>
                      {practice.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="dashboard-inline-actions" style={{ alignSelf: 'flex-start' }}>
              <button type="submit" className="action-button" style={{ backgroundColor: '#007f3b' }}>
                {editingUser ? 'Save Changes' : 'Create Practice User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="dashboard-panel dashboard-section">
        <div className="dashboard-panel-header">
          <div>
            <h2 className="dashboard-panel-title">Practice Users ({practiceUsers.length})</h2>
            <p className="dashboard-panel-subtitle">Assign users to one or more practices, manage memberships, and send reset links.</p>
          </div>
          <div className="dashboard-inline-actions">
            <button onClick={() => void loadPracticeUsers()} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <RefreshCw size={16} /> Refresh
            </button>
            {!showAddForm && !editingUser && (
              <button onClick={openAddForm} className="action-button" style={{ backgroundColor: '#005eb8' }}>
                <Plus size={16} /> Add Practice User
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#4c6272' }}>Loading practice users...</p>
        ) : practiceUsers.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No practice users found yet.</p>
        ) : (
          <div className="dashboard-list">
            {practiceUsers.map((practiceUser) => (
              <div key={practiceUser.uid} className="dashboard-list-card">
                <div className="dashboard-list-main">
                  <div className="dashboard-list-title">{practiceUser.name || practiceUser.email}</div>
                  <div className="dashboard-meta">
                    <span>{practiceUser.email}</span>
                    <span className={`dashboard-badge ${practiceUser.is_active ? 'dashboard-badge--green' : 'dashboard-badge--red'}`}>
                      {practiceUser.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span>{practiceUser.memberships.length} practice{practiceUser.memberships.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="dashboard-chip-row" style={{ marginTop: '0.6rem' }}>
                    {practiceUser.memberships.map((membership) => (
                      <span key={membership.id} className={`dashboard-chip${membership.is_default ? ' dashboard-chip--active' : ''}`}>
                        {membership.practice.name}{membership.is_default ? ' (Default)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="dashboard-list-actions">
                  <button onClick={() => openEditForm(practiceUser)} className="dashboard-pill-button dashboard-pill-button--primary">
                    <Edit2 size={14} /> Edit
                  </button>
                  <button onClick={() => void sendPasswordReset(practiceUser)} className="dashboard-pill-button">
                    <Mail size={14} /> Reset Password
                  </button>
                  <button onClick={() => deletePracticeUser(practiceUser)} className="dashboard-pill-button dashboard-pill-button--danger">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default PracticeUserManagement;
