import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface UserProfile {
    uid: string;
    email: string;
    photoURL?: string;
    userType?: 'single' | 'organisation' | 'pro';
    onboardingComplete: boolean;
    createdAt: any;
    updatedAt: any;
    bio?: string;
    socialLinks?: {
        twitter?: string;
        linkedin?: string;
        website?: string;
    };
    // Organisation-specific fields
    organisationId?: string;
    organisationRole?: 'admin' | 'member';
    organisationName?: string;
    // Pro-specific fields
    proOrganisationId?: string;
    proOrganisationRole?: 'admin' | 'member';
    proOrganisationName?: string;
    isPro?: boolean;
    proPromptShown?: boolean;
}

export interface Organisation {
    id: string;
    name: string;
    description: string;
    sector: string;
    incorporated: boolean;
    adminEmail: string;
    adminUid: string;
    createdAt: any;
    updatedAt: any;
    members: string[]; // Array of user UIDs
}

export interface ProOrganisation {
    id: string;
    name: string;
    description: string;
    adminEmail: string;
    adminUid: string;
    createdAt: any;
    updatedAt: any;
    members: string[]; // Array of user UIDs (max 5)
    maxMembers: 5;
}

/**
 * Create or update user profile in Firestore
 */
export async function createUserProfile(uid: string, email: string): Promise<void> {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        await setDoc(userRef, {
            uid,
            email,
            onboardingComplete: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
    }
    return null;
}

/**
 * Update user type (single or organisation)
 */
export async function updateUserType(uid: string, userType: 'single' | 'organisation'): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        userType,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Create a new organisation
 */
export async function createOrganisation(
    organisationData: Omit<Organisation, 'id' | 'createdAt' | 'updatedAt' | 'members'>
): Promise<string> {
    const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orgRef = doc(db, 'organisations', orgId);

    await setDoc(orgRef, {
        ...organisationData,
        id: orgId,
        members: [organisationData.adminUid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Update user profile with organisation info
    const userRef = doc(db, 'users', organisationData.adminUid);
    await updateDoc(userRef, {
        userType: 'organisation',
        organisationId: orgId,
        organisationRole: 'admin',
        organisationName: organisationData.name,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
    });

    return orgId;
}

/**
 * Join an existing organisation
 */
export async function joinOrganisation(uid: string, email: string, organisationId: string): Promise<boolean> {
    const orgRef = doc(db, 'organisations', organisationId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
        return false;
    }

    const orgData = orgSnap.data() as Organisation;

    // Add user to organisation members
    const updatedMembers = [...(orgData.members || []), uid];
    await updateDoc(orgRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp(),
    });

    // Update user profile
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        userType: 'organisation',
        organisationId,
        organisationRole: 'member',
        organisationName: orgData.name,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
    });

    return true;
}

/**
 * Get organisation details
 */
export async function getOrganisation(organisationId: string): Promise<Organisation | null> {
    const orgRef = doc(db, 'organisations', organisationId);
    const orgSnap = await getDoc(orgRef);

    if (orgSnap.exists()) {
        return orgSnap.data() as Organisation;
    }
    return null;
}

/**
 * Check if email domain is custom (not common providers)
 */
export function isCustomDomain(email: string): boolean {
    const commonDomains = [
        'gmail.com',
        'yahoo.com',
        'outlook.com',
        'hotmail.com',
        'icloud.com',
        'protonmail.com',
        'aol.com',
        'mail.com',
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    return !commonDomains.includes(domain);
}

/**
 * Get all members of an organisation with their details
 */
export async function getOrganisationMembers(organisationId: string): Promise<UserProfile[]> {
    const org = await getOrganisation(organisationId);
    if (!org || !org.members) {
        return [];
    }

    const memberProfiles: UserProfile[] = [];
    for (const memberId of org.members) {
        const profile = await getUserProfile(memberId);
        if (profile) {
            memberProfiles.push(profile);
        }
    }

    return memberProfiles;
}

/**
 * Update a member's role in the organisation
 */
export async function updateMemberRole(
    uid: string,
    organisationId: string,
    newRole: 'admin' | 'member'
): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        organisationRole: newRole,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Remove a member from the organisation
 */
export async function removeMemberFromOrganisation(
    uid: string,
    organisationId: string
): Promise<void> {
    // Get organisation
    const orgRef = doc(db, 'organisations', organisationId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
        throw new Error('Organisation not found');
    }

    const orgData = orgSnap.data() as Organisation;

    // Remove user from organisation members
    const updatedMembers = orgData.members.filter(memberId => memberId !== uid);
    await updateDoc(orgRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp(),
    });

    // Update user profile to remove organisation info
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        userType: 'single',
        organisationId: null,
        organisationRole: null,
        organisationName: null,
        updatedAt: serverTimestamp(),
    });
}

/**
 * PRO ORGANISATION FUNCTIONS
 */

/**
 * Create a new Pro organisation (max 5 members)
 */
export async function createProOrganisation(
    organisationData: Omit<ProOrganisation, 'id' | 'createdAt' | 'updatedAt' | 'members' | 'maxMembers'>
): Promise<string> {
    const proOrgId = `pro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const proOrgRef = doc(db, 'proOrganisations', proOrgId);

    await setDoc(proOrgRef, {
        ...organisationData,
        id: proOrgId,
        members: [organisationData.adminUid],
        maxMembers: 5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // Update user profile with Pro organisation info
    const userRef = doc(db, 'users', organisationData.adminUid);
    await updateDoc(userRef, {
        userType: 'pro',
        proOrganisationId: proOrgId,
        proOrganisationRole: 'admin',
        proOrganisationName: organisationData.name,
        isPro: true,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
    });

    return proOrgId;
}

/**
 * Join an existing Pro organisation (validates 5-member limit)
 */
export async function joinProOrganisation(uid: string, email: string, proOrganisationId: string): Promise<boolean> {
    const proOrgRef = doc(db, 'proOrganisations', proOrganisationId);
    const proOrgSnap = await getDoc(proOrgRef);

    if (!proOrgSnap.exists()) {
        return false;
    }

    const proOrgData = proOrgSnap.data() as ProOrganisation;

    // Check if organisation has reached member limit
    if (proOrgData.members.length >= 5) {
        throw new Error('Pro organisation has reached maximum capacity (5 members)');
    }

    // Add user to Pro organisation members
    const updatedMembers = [...(proOrgData.members || []), uid];
    await updateDoc(proOrgRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp(),
    });

    // Update user profile
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        userType: 'pro',
        proOrganisationId,
        proOrganisationRole: 'member',
        proOrganisationName: proOrgData.name,
        isPro: true,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
    });

    return true;
}

/**
 * Get Pro organisation details
 */
export async function getProOrganisation(proOrganisationId: string): Promise<ProOrganisation | null> {
    const proOrgRef = doc(db, 'proOrganisations', proOrganisationId);
    const proOrgSnap = await getDoc(proOrgRef);

    if (proOrgSnap.exists()) {
        return proOrgSnap.data() as ProOrganisation;
    }
    return null;
}

/**
 * Get all members of a Pro organisation with their details
 */
export async function getProOrganisationMembers(proOrganisationId: string): Promise<UserProfile[]> {
    const proOrg = await getProOrganisation(proOrganisationId);
    if (!proOrg || !proOrg.members) {
        return [];
    }

    const memberProfiles: UserProfile[] = [];
    for (const memberId of proOrg.members) {
        const profile = await getUserProfile(memberId);
        if (profile) {
            memberProfiles.push(profile);
        }
    }

    return memberProfiles;
}

/**
 * Update a member's role in the Pro organisation
 */
export async function updateProMemberRole(
    uid: string,
    proOrganisationId: string,
    newRole: 'admin' | 'member'
): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        proOrganisationRole: newRole,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Remove a member from the Pro organisation
 */
export async function removeProMemberFromOrganisation(
    uid: string,
    proOrganisationId: string
): Promise<void> {
    // Get Pro organisation
    const proOrgRef = doc(db, 'proOrganisations', proOrganisationId);
    const proOrgSnap = await getDoc(proOrgRef);

    if (!proOrgSnap.exists()) {
        throw new Error('Pro organisation not found');
    }

    const proOrgData = proOrgSnap.data() as ProOrganisation;

    // Remove user from Pro organisation members
    const updatedMembers = proOrgData.members.filter(memberId => memberId !== uid);
    await updateDoc(proOrgRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp(),
    });

    // Update user profile to remove Pro organisation info
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        userType: 'single',
        proOrganisationId: null,
        proOrganisationRole: null,
        proOrganisationName: null,
        isPro: false,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Check if Pro organisation can accept new members
 */
export async function checkProMemberLimit(proOrganisationId: string): Promise<{ canJoin: boolean; currentCount: number; maxCount: number }> {
    const proOrg = await getProOrganisation(proOrganisationId);

    if (!proOrg) {
        return { canJoin: false, currentCount: 0, maxCount: 5 };
    }

    const currentCount = proOrg.members.length;
    const canJoin = currentCount < 5;

    return { canJoin, currentCount, maxCount: 5 };
}

/**
 * Mark Pro prompt as shown for user
 */
export async function markProPromptShown(uid: string): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        proPromptShown: true,
        updatedAt: serverTimestamp(),
    });
}

