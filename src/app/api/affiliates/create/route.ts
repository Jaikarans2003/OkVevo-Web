import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { verifyAdminToken } from '@/lib/firebase-admin';

function generateCouponCode(name: string): string {
    // Take first 5-6 letters of name (uppercase)
    const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 6);
    // Add 2-digit random number
    const randomNum = Math.floor(10 + Math.random() * 90); // 10-99
    return `${cleanName}${randomNum}`;
}

export async function POST(request: NextRequest) {
    try {
        // Verify admin authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const isAdmin = await verifyAdminToken(token);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { name, phoneNumber, email } = body;

        if (!name || !phoneNumber || !email) {
            return NextResponse.json({ error: 'Name, phone number, and email are required' }, { status: 400 });
        }

        // Validate phone number format (basic validation)
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return NextResponse.json({ error: 'Phone number must be 10 digits' }, { status: 400 });
        }

        // Check if affiliate with this phone number already exists
        const affiliateDocRef = doc(db, 'affiliates', phoneNumber);
        const existingAffiliateDoc = await getDoc(affiliateDocRef);

        if (existingAffiliateDoc.exists()) {
            return NextResponse.json({ error: 'Affiliate with this phone number already exists' }, { status: 400 });
        }

        // Check if affiliate with this email already exists
        const affiliatesRef = collection(db, 'affiliates');
        const existingQuery = query(affiliatesRef, where('email', '==', email));
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
            return NextResponse.json({ error: 'Affiliate with this email already exists' }, { status: 400 });
        }

        // Generate unique coupon code
        let couponCode = generateCouponCode(name);
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            const couponQuery = query(affiliatesRef, where('couponCode', '==', couponCode));
            const couponSnapshot = await getDocs(couponQuery);
            
            if (couponSnapshot.empty) {
                isUnique = true;
            } else {
                couponCode = generateCouponCode(name);
                attempts++;
            }
        }

        if (!isUnique) {
            return NextResponse.json({ error: 'Failed to generate unique coupon code' }, { status: 500 });
        }

        // Create affiliate document with phone number as ID
        const affiliateData = {
            phoneNumber,
            name,
            email,
            couponCode,
            totalSales: 0,
            totalEarnings: 0,
            commissionRate: 10, // 10% commission
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(affiliateDocRef, affiliateData);

        // Create corresponding coupon
        const couponsRef = collection(db, 'coupons');
        const couponData = {
            code: couponCode,
            type: 'affiliate',
            discountAmount: 0, // No discount for user
            discountType: 'none',
            affiliateId: phoneNumber, // Phone number is the affiliate ID
            isActive: true,
            minOrderValue: 199,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await addDoc(couponsRef, couponData);

        return NextResponse.json({
            success: true,
            affiliateId: phoneNumber,
            couponCode,
            name,
            phoneNumber,
            email,
        });

    } catch (error) {
        console.error('Create affiliate error:', error);
        return NextResponse.json({ error: 'Failed to create affiliate' }, { status: 500 });
    }
}
