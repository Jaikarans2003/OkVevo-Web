"use client";

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged, User, updateEmail } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import { getUserSubscription, type SubscriptionWithPlanDetails } from '../../services/SubscriptionService';
import { Loader2, Check, AlertCircle, Edit3, Activity, Phone, Crown, Building2, Users } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingScreen from '@/components/shared/LoadingScreen';
import PortalShell from '@/components/portal/PortalShell';
import DrawnArt from '@/components/landing-page/DrawnArt';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionWithPlanDetails | null>(null);
    const [affiliateData, setAffiliateData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

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
                    const [profileData, subData] = await Promise.all([
                        getUserProfile(currentUser.uid),
                        getUserSubscription(currentUser.uid)
                    ]);
                    setProfile(profileData);
                    setSubscription(subData);
                    
                    try {
                        const affiliatesRef = collection(db, 'affiliates');
                        const affiliateQuery = query(affiliatesRef, where('email', '==', currentUser.email));
                        const affiliateSnapshot = await getDocs(affiliateQuery);
                        if (!affiliateSnapshot.empty) {
                            const affiliateDoc = affiliateSnapshot.docs[0];
                            setAffiliateData({
                                id: affiliateDoc.id,
                                ...affiliateDoc.data()
                            });
                        }
                    } catch {
                        // affiliates is client-denied; leftover query may be empty
                    }
                    setFormData({
                        email: profileData?.email || currentUser.email || '',
                        phoneNumber: profileData?.phoneNumber || '',
                        bio: profileData?.bio || ''
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

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                bio: formData.bio,
                updatedAt: serverTimestamp()
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

    const userTypeConfig = {
        single: { label: 'Individual', icon: Users, ink: 'ochre', detail: 'Single user account' },
        pro: { label: 'Pro Team', icon: Crown, ink: 'orange', detail: '5-seat team account' },
        organisation: { label: 'Organisation', icon: Building2, ink: 'slate', detail: 'Organisation account' },
    };
    const typeKey = (profile?.userType || 'single') as keyof typeof userTypeConfig;
    const typeInfo = userTypeConfig[typeKey] || userTypeConfig.single;

    const facts = [
        {
            label: 'Subscription Plan',
            value: subscription?.planDetails?.name || 'No active plan',
            icon: Activity,
            ink: 'teal',
            detail: subscription?.status ? `Status: ${subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}` : 'Manage it in billing',
            href: '/billing',
        },
        { label: 'Account Type', value: typeInfo.label, icon: typeInfo.icon, ink: typeInfo.ink, detail: typeInfo.detail },
        { label: 'Phone', value: formData.phoneNumber || 'Not added', icon: Phone, ink: 'olive', detail: 'Primary contact' },
        ...(affiliateData ? [{
            label: 'Affiliate Earnings',
            value: `₹${affiliateData.totalEarnings || 0}`,
            icon: Activity,
            ink: 'rust',
            detail: `${affiliateData.totalSales || 0} sales • ${affiliateData.couponCode || 'N/A'}`,
        }] : []),
    ];
    const closeEdit = () => { setIsEditing(false); setStatus({ type: null, message: '' }); };

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
            </div>
        </PortalShell>
    );
}
