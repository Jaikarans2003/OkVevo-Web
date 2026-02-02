import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, UserProfile } from '../services/userService';

export interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to get current authenticated user and their profile
 */
export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        userProfile: null,
        loading: true,
        error: null
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Fetch user profile from Firestore
                    const profile = await getUserProfile(user.uid);

                    setAuthState({
                        user,
                        userProfile: profile,
                        loading: false,
                        error: null
                    });
                } catch (error) {
                    console.error('Failed to fetch user profile:', error);
                    setAuthState({
                        user,
                        userProfile: null,
                        loading: false,
                        error: 'Failed to load user profile'
                    });
                }
            } else {
                setAuthState({
                    user: null,
                    userProfile: null,
                    loading: false,
                    error: null
                });
            }
        });

        return () => unsubscribe();
    }, []);

    /**
     * Get the ID to use for storage (userId or organisationId)
     */
    const getStorageId = (): string | null => {
        if (!authState.userProfile) return null;

        // If user is part of an organisation, use organisationId
        if (authState.userProfile.organisationId) {
            return authState.userProfile.organisationId;
        }

        // If user is part of a pro organisation, use proOrganisationId
        if (authState.userProfile.proOrganisationId) {
            return authState.userProfile.proOrganisationId;
        }

        // Otherwise use userId
        return authState.userProfile.uid;
    };

    /**
     * Check if user is authenticated
     */
    const isAuthenticated = (): boolean => {
        return authState.user !== null;
    };

    /**
     * Get user type
     */
    const getUserType = (): 'single' | 'organisation' | 'pro' | null => {
        return authState.userProfile?.userType || null;
    };

    return {
        ...authState,
        getStorageId,
        isAuthenticated,
        getUserType
    };
}
