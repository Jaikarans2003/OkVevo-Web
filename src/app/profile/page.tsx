"use client";

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../config/firebase';
import { onAuthStateChanged, User, updateEmail } from 'firebase/auth';
import type { UserProfile } from '../../services/userService';
import { Loader2, Check, AlertCircle, Edit3, Activity, Phone, Crown, Building2, Users } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingScreen from '@/components/shared/LoadingScreen';
import PortalShell from '@/components/portal/PortalShell';
import DrawnArt from '@/components/landing-page/DrawnArt';
import { authedJson } from '@/lib/api/browser';
import type { MePayload } from '@/lib/api/me';
import type { BillingSummary } from '@/lib/api/billingSummary';
import {
    readActiveOrgPublicId,
    resolveActiveOrg,
    showCreateOrganisationUnder,
    showJoinWithCode,
    writeActiveOrgPublicId,
} from '@/lib/orgs/activeOrg';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [me, setMe] = useState<MePayload | null>(null);
    const [billing, setBilling] = useState<BillingSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
    const [orgName, setOrgName] = useState('');
    const [orgNameConfirm, setOrgNameConfirm] = useState('');
    const [childOrgName, setChildOrgName] = useState('');
    const [childOwnerEmail, setChildOwnerEmail] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [applyMessage, setApplyMessage] = useState('');
    const [orgBusy, setOrgBusy] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        phoneNumber: '',
        bio: ''
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const [mePayload, summary] = await Promise.all([
                        authedJson<MePayload>(currentUser, '/api/me'),
                        authedJson<BillingSummary>(currentUser, '/api/billing/summary'),
                    ]);
                    const profileData: UserProfile = {
                        uid: mePayload.user.id,
                        email: mePayload.user.email || currentUser.email || '',
                        onboardingComplete: true,
                        bio: mePayload.user.bio ?? undefined,
                        phoneNumber: mePayload.user.phoneNumber ?? undefined,
                        createdAt: null,
                        updatedAt: null,
                    };
                    setMe(mePayload);
                    setProfile(profileData);
                    setBilling(summary);
                    setFormData({
                        email: profileData.email,
                        phoneNumber: profileData.phoneNumber || '',
                        bio: profileData.bio || '',
                    });
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            } else {
                router.push('/login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        setSaving(true);
        setStatus({ type: null, message: '' });

        try {
            if (formData.email !== user.email) {
                try {
                    await updateEmail(user, formData.email);
                } catch (error: any) {
                    if (error.code === 'auth/requires-recent-login') {
                        setStatus({ type: 'error', message: 'Please log out and log back in to change your email.' });
                        setSaving(false);
                        return;
                    } else {
                        throw error;
                    }
                }
            }

            await authedJson(user, '/api/me', {
                method: 'PATCH',
                body: JSON.stringify({
                    phoneNumber: formData.phoneNumber,
                    bio: formData.bio,
                }),
            });

            setProfile(prev => prev ? { ...prev, email: formData.email, phoneNumber: formData.phoneNumber, bio: formData.bio } : null);
            setStatus({ type: 'success', message: 'Saved.' });
            
            setTimeout(() => {
                setStatus({ type: null, message: '' });
                setIsEditing(false);
            }, 800);

        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: error.message || 'An error occurred.' });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <LoadingScreen loadKey="profile" />;
    }

    if (!user) return null;

    const accountKind = billing?.accountKind || 'individual';
    const typeInfo =
        accountKind === 'super_org'
            ? { label: 'Super-organisation', icon: Crown, ink: 'orange', detail: 'Parent organisation' }
            : accountKind === 'org'
              ? { label: 'Organisation', icon: Building2, ink: 'slate', detail: 'Organisation account' }
              : { label: 'Individual', icon: Users, ink: 'ochre', detail: 'Personal account' };

    const facts = [
        {
            label: 'Subscription Plan',
            value: billing?.planName || billing?.plan || 'No active plan',
            icon: Activity,
            ink: 'teal',
            detail: billing?.status
                ? `Status: ${billing.status.charAt(0).toUpperCase() + billing.status.slice(1)}`
                : 'Manage it in billing',
            href: '/billing',
        },
        { label: 'Account Type', value: typeInfo.label, icon: typeInfo.icon, ink: typeInfo.ink, detail: typeInfo.detail },
        { label: 'Phone', value: formData.phoneNumber || 'Not added', icon: Phone, ink: 'olive', detail: 'Primary contact' },
    ];
    const closeEdit = () => { setIsEditing(false); setStatus({ type: null, message: '' }); };

    const runOrgAction = async (fn: () => Promise<void>) => {
        if (!user) return;
        setOrgBusy(true);
        setStatus({ type: null, message: '' });
        try {
            await fn();
            const refreshed = await authedJson<MePayload>(user, '/api/me');
            setMe(refreshed);
            setStatus({ type: 'success', message: 'Done.' });
        } catch (e: unknown) {
            setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Request failed' });
        } finally {
            setOrgBusy(false);
        }
    };

    return (
        <PortalShell>
            <section className="wrap pt-head">
                <div>
                    <h1>{user.displayName || 'Your profile'}<span>.</span></h1>
                    <p className="sub">{formData.email}</p>
                    {profile?.bio && !isEditing ? <p className="pt-bio">{profile.bio}</p> : null}
                    {!isEditing && (
                        <div className="pt-actions">
                            <button type="button" onClick={() => setIsEditing(true)} className="btn btn--go">
                                <Edit3 size={16} aria-hidden />
                                Edit profile
                            </button>
                        </div>
                    )}
                </div>
                <DrawnArt name="profile" layers={7} width={1100} height={917} float={[6]} className="pt-art"
                    alt="An OkVevo ID badge on an orange lanyard with a portrait and ruled details, a pen leaning beside it" />
            </section>

            <div className="wrap pt-stack">
                <AnimatePresence mode="wait">
                    {!isEditing ? (
                        <motion.ul
                            key="facts"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            className="pt-facts"
                        >
                            {facts.map((fact, i) => {
                                const inner = (
                                    <>
                                        <span className="ic"><fact.icon size={18} aria-hidden /></span>
                                        <p className="pt-label">{fact.label}</p>
                                        <b>{fact.value}</b>
                                        <p className="pt-fine">{fact.detail}</p>
                                    </>
                                );
                                const style = { '--spot': `var(--${fact.ink})` } as CSSProperties;
                                return (
                                    <motion.li
                                        key={fact.label}
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
                                        style={{ display: 'grid' }}
                                    >
                                        {'href' in fact && fact.href ? (
                                            <Link href={fact.href} className="pt-fact" style={style}>{inner}</Link>
                                        ) : (
                                            <div className="pt-fact" style={style}>{inner}</div>
                                        )}
                                    </motion.li>
                                );
                            })}
                        </motion.ul>
                    ) : (
                        <motion.form
                            key="edit"
                            onSubmit={handleSave}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            className="pt-edit"
                        >
                            <h2>Edit profile</h2>
                            <div className="pt-field">
                                <label htmlFor="profile-email">Email</label>
                                <input
                                    id="profile-email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="pt-input"
                                    placeholder="email@domain.com"
                                />
                            </div>
                            <div className="pt-field">
                                <label htmlFor="profile-phone">Phone</label>
                                <input
                                    id="profile-phone"
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    className="pt-input"
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div className="pt-field">
                                <label htmlFor="profile-bio">Bio</label>
                                <textarea
                                    id="profile-bio"
                                    value={formData.bio}
                                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                    className="pt-input"
                                    placeholder="A line about you and your business"
                                />
                            </div>

                            {status.message && (
                                <motion.p
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`pt-note ${status.type === 'success' ? 'pt-note--good' : 'pt-note--bad'}`}
                                    role={status.type === 'success' ? 'status' : 'alert'}
                                >
                                    {status.type === 'success' ? <Check size={18} aria-hidden /> : <AlertCircle size={18} aria-hidden />}
                                    {status.message}
                                </motion.p>
                            )}

                            <div className="pt-row">
                                <button type="submit" disabled={saving} className="btn btn--go">
                                    {saving ? <><Loader2 size={16} className="animate-spin" aria-hidden /><span className="sr-only">Saving…</span></> : 'Save changes'}
                                </button>
                                <button type="button" onClick={closeEdit} className="btn">
                                    Cancel
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>

                {!isEditing && me ? (
                    <section className="pt-stack" style={{ marginTop: 28 }}>
                        <h2>Organisation</h2>
                        {(() => {
                            const activeOrgPublicId = resolveActiveOrg({
                                stored: readActiveOrgPublicId(),
                                hidePersonal: me.hidePersonal,
                                upgradedOrgPublicId: me.upgradedOrgPublicId,
                                memberships: me.memberships,
                            });
                            const createUnder = showCreateOrganisationUnder({
                                activeOrgPublicId,
                                upgradedOrgPublicId: me.upgradedOrgPublicId,
                                memberships: me.memberships,
                            });
                            if (!createUnder.show) return null;
                            return (
                                <div className="pt-fact" style={{ '--spot': 'var(--teal)' } as CSSProperties}>
                                    <p className="pt-label">
                                        Create organisation under {createUnder.name}
                                    </p>
                                    <p className="pt-fine">
                                        Creates a prepaid child organisation. The owner receives a pending invite.
                                    </p>
                                    <div className="pt-field" style={{ marginTop: 12 }}>
                                        <label htmlFor="child-org-name">Organisation name</label>
                                        <input
                                            id="child-org-name"
                                            className="pt-input"
                                            value={childOrgName}
                                            onChange={(e) => setChildOrgName(e.target.value)}
                                            placeholder="Acme Studio"
                                        />
                                    </div>
                                    <div className="pt-field">
                                        <label htmlFor="child-owner-email">Owner email</label>
                                        <input
                                            id="child-owner-email"
                                            className="pt-input"
                                            type="email"
                                            value={childOwnerEmail}
                                            onChange={(e) => setChildOwnerEmail(e.target.value)}
                                            placeholder="owner@example.com"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn--go"
                                        disabled={orgBusy || !childOrgName.trim() || !childOwnerEmail.trim()}
                                        onClick={() =>
                                            runOrgAction(async () => {
                                                await authedJson(user!, '/api/orgs', {
                                                    method: 'POST',
                                                    body: JSON.stringify({
                                                        name: childOrgName.trim(),
                                                        parent: createUnder.parentPublicId,
                                                        ownerEmail: childOwnerEmail.trim(),
                                                    }),
                                                });
                                                setChildOrgName('');
                                                setChildOwnerEmail('');
                                            })
                                        }
                                    >
                                        Create organisation
                                    </button>
                                </div>
                            );
                        })()}
                        {!me.hidePersonal ? (
                            <div className="pt-fact" style={{ '--spot': 'var(--slate)' } as CSSProperties}>
                                <p className="pt-label">Upgrade to organisation</p>
                                <p className="pt-fine">This can&apos;t be undone. Your plan and credits stay on the same wallet.</p>
                                <div className="pt-field" style={{ marginTop: 12 }}>
                                    <label htmlFor="org-name">Organisation name</label>
                                    <input
                                        id="org-name"
                                        className="pt-input"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        placeholder="Acme Studio"
                                    />
                                </div>
                                <div className="pt-field">
                                    <label htmlFor="org-name-confirm">Type the name to confirm</label>
                                    <input
                                        id="org-name-confirm"
                                        className="pt-input"
                                        value={orgNameConfirm}
                                        onChange={(e) => setOrgNameConfirm(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn--go"
                                    disabled={orgBusy || !orgName.trim() || orgName.trim() !== orgNameConfirm.trim()}
                                    onClick={() =>
                                        runOrgAction(async () => {
                                            const upgraded = await authedJson<{
                                                success?: boolean;
                                                orgPublicId?: string;
                                            }>(user!, '/api/me/upgrade', {
                                                method: 'POST',
                                                body: JSON.stringify({ name: orgName.trim() }),
                                            });
                                            setOrgName('');
                                            setOrgNameConfirm('');
                                            if (upgraded.orgPublicId) {
                                                writeActiveOrgPublicId(upgraded.orgPublicId);
                                                router.push('/dashboard');
                                            }
                                        })
                                    }
                                >
                                    Upgrade
                                </button>
                            </div>
                        ) : null}

                        {me.pendingInvites?.length ? (
                            <div className="pt-fact" style={{ '--spot': 'var(--orange)' } as CSSProperties}>
                                <p className="pt-label">Pending invitations</p>
                                {me.pendingInvites.map((inv) => (
                                    <div key={inv.invitationId} style={{ marginTop: 12 }}>
                                        <p className="pt-fine">
                                            {inv.orgName} — {inv.role}
                                        </p>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button
                                                type="button"
                                                className="btn btn--go"
                                                disabled={orgBusy}
                                                onClick={() =>
                                                    runOrgAction(async () => {
                                                        await authedJson(user!, '/api/invitations/accept', {
                                                            method: 'POST',
                                                            body: JSON.stringify({ invitationId: inv.invitationId }),
                                                        });
                                                    })
                                                }
                                            >
                                                Accept
                                            </button>
                                            <button
                                                type="button"
                                                className="btn"
                                                disabled={orgBusy}
                                                onClick={() =>
                                                    runOrgAction(async () => {
                                                        await authedJson(user!, '/api/invitations/decline', {
                                                            method: 'POST',
                                                            body: JSON.stringify({ invitationId: inv.invitationId }),
                                                        });
                                                    })
                                                }
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {me.pendingOrgInvitations?.length ? (
                            <div className="pt-fact" style={{ '--spot': 'var(--slate)' } as CSSProperties}>
                                <p className="pt-label">Super-organisation invitations</p>
                                {me.pendingOrgInvitations.map((inv) => (
                                    <div key={inv.id} style={{ marginTop: 12 }}>
                                        <p className="pt-fine">
                                            {inv.superOrgName} wants to manage {inv.orgPublicId}
                                        </p>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button
                                                type="button"
                                                className="btn btn--go"
                                                disabled={orgBusy}
                                                onClick={() =>
                                                    runOrgAction(async () => {
                                                        await authedJson(
                                                            user!,
                                                            `/api/orgs/${inv.orgPublicId}/accept-parent`,
                                                            {
                                                                method: 'POST',
                                                                body: JSON.stringify({ superOrgPublicId: inv.superOrgPublicId }),
                                                            }
                                                        );
                                                    })
                                                }
                                            >
                                                Accept
                                            </button>
                                            <button
                                                type="button"
                                                className="btn"
                                                disabled={orgBusy}
                                                onClick={() =>
                                                    runOrgAction(async () => {
                                                        await authedJson(
                                                            user!,
                                                            `/api/orgs/${inv.orgPublicId}/decline-parent`,
                                                            {
                                                                method: 'POST',
                                                                body: JSON.stringify({ superOrgPublicId: inv.superOrgPublicId }),
                                                            }
                                                        );
                                                    })
                                                }
                                            >
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {showJoinWithCode(me.hidePersonal) ? (
                            <div className="pt-fact" style={{ '--spot': 'var(--olive)' } as CSSProperties}>
                                <p className="pt-label">Join with a code</p>
                                <p className="pt-fine">Keeps your personal account. Switch accounts from the header.</p>
                                <div className="pt-field" style={{ marginTop: 12 }}>
                                    <label htmlFor="join-code">Join code</label>
                                    <input
                                        id="join-code"
                                        className="pt-input"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={orgBusy || !joinCode.trim()}
                                    onClick={() =>
                                        runOrgAction(async () => {
                                            await authedJson(user!, '/api/orgs/join', {
                                                method: 'POST',
                                                body: JSON.stringify({ code: joinCode.trim() }),
                                            });
                                            setJoinCode('');
                                        })
                                    }
                                >
                                    Join
                                </button>
                            </div>
                        ) : null}

                        <div className="pt-fact" style={{ '--spot': 'var(--orange)' } as CSSProperties}>
                            <p className="pt-label">Apply for super-organisation</p>
                            <p className="pt-fine">
                                {me.hidePersonal
                                    ? 'Applies to the organisation you own.'
                                    : 'Applies to your personal account (or upgrade first).'}
                            </p>
                            <div className="pt-field" style={{ marginTop: 12 }}>
                                <label htmlFor="apply-msg">Why you need it</label>
                                <textarea
                                    id="apply-msg"
                                    className="pt-input"
                                    value={applyMessage}
                                    onChange={(e) => setApplyMessage(e.target.value)}
                                    placeholder="Tell us about your team"
                                />
                            </div>
                            <button
                                type="button"
                                className="btn"
                                disabled={orgBusy || !applyMessage.trim()}
                                onClick={() =>
                                    runOrgAction(async () => {
                                        const subject =
                                            me.hidePersonal && me.upgradedOrgPublicId
                                                ? me.upgradedOrgPublicId
                                                : undefined;
                                        await authedJson(user!, '/api/contact', {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                category: 'super_org_application',
                                                email: formData.email,
                                                message: applyMessage.trim(),
                                                ...(subject ? { subjectOrgPublicId: subject } : {}),
                                            }),
                                        });
                                        setApplyMessage('');
                                    })
                                }
                            >
                                Submit application
                            </button>
                        </div>

                        {me.memberships.length > 0 ? (
                            <ul className="pt-facts">
                                {me.memberships.map((m) => (
                                    <li key={m.orgPublicId}>
                                        <div className="pt-fact" style={{ '--spot': 'var(--teal)' } as CSSProperties}>
                                            <p className="pt-label">{m.kind === 'super_org' ? 'Super-org' : 'Organisation'}</p>
                                            <b>{m.name}</b>
                                            <p className="pt-fine">Role: {m.role}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        {status.message && !isEditing ? (
                            <p
                                className={`pt-note ${status.type === 'success' ? 'pt-note--good' : 'pt-note--bad'}`}
                                role={status.type === 'success' ? 'status' : 'alert'}
                            >
                                {status.message}
                            </p>
                        ) : null}
                    </section>
                ) : null}
            </div>
        </PortalShell>
    );
}
