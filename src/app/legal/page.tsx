'use client';

import { useState, useEffect } from 'react';
import DashNavbar from '@/components/workspace/WorkspaceNavbar';
import Footer from '@/components/ook/Footer';
import { motion } from 'framer-motion';
import { ChevronRight, Scale, Shield, Landmark, BookOpen, AlertTriangle, FileText, Database, Lock, Cpu, Image as ImageIcon, Sparkles, ShoppingBag, Copyright, CreditCard, RefreshCw, Code } from 'lucide-react';

const policies = [
    {
        id: 'terms-of-use',
        title: 'Terms of Use',
        icon: <Scale className="w-5 h-5" />,
        content: `
# TERMS OF USE

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

## 1. Introduction
Welcome to the digital platforms and services operated by Azonova Technologies Private Limited (“Azonova”, “Company”, “we”, “our”, or “us”).
These Terms of Use (“Terms”) govern access to and use of:
* Azonova websites
* digital platforms and applications
* technology products and services
* AI-based tools and content systems
* creator and user ecosystems
including but not limited to the platforms operated under Azonova’s technology infrastructure.

By accessing or using our services, you agree to comply with and be legally bound by these Terms.
If you do not agree with these Terms, you must discontinue use of our services immediately.

## 2. Eligibility
By using Azonova services, you confirm that:
* You are at least 18 years old, or
* You are using the services under parental or legal guardian supervision.
* You have the legal capacity to enter into a binding agreement.
The Company reserves the right to restrict or terminate access if these conditions are not satisfied.

## 3. Scope of Services
Azonova Technologies Private Limited develops and operates technology platforms, digital tools, and creative ecosystems which may include:
* content creation platforms
* AI-driven content tools
* digital marketplaces
* creator ecosystems
* platform infrastructure for media distribution
* subscription-based or free digital services
Certain services may have platform-specific terms that supplement these Terms.

## 4. User Accounts
Some services may require users to create an account.
Users agree that they will:
* Provide accurate and complete information
* Maintain confidentiality of login credentials
* Be responsible for all activity conducted under their account
Azonova is not liable for any unauthorized access resulting from a user’s failure to secure their account.

## 5. Acceptable Use
Users must use the services only for lawful purposes.
Users shall not:
* Violate any applicable laws or regulations
* Upload harmful, abusive, defamatory, or illegal content
* Attempt to disrupt platform functionality
* Attempt unauthorized access to systems or databases
* Distribute malware, bots, or malicious code
* Infringe intellectual property rights
* Misuse AI tools for deceptive or harmful activities
Further acceptable use standards are detailed in our Acceptable Use Policy.

## 6. Intellectual Property
All content, software, technology, branding, and materials on Azonova platforms are owned by or licensed to the Company.
This includes but is not limited to:
* logos
* platform design
* software systems
* algorithms
* AI tools
* audiovisual material
* written content
Users may not reproduce, distribute, modify, or commercially exploit any materials without prior written permission.
Specific intellectual property rules are detailed in the Copyright and IP Policy.

## 7. User Generated Content
Some Azonova services allow users to upload or create content.
By submitting content, users confirm that:
* They own the rights to the content or have proper authorization
* The content does not violate any laws or third-party rights
Users grant Azonova a non-exclusive, worldwide, royalty-free license to host, display, process, and distribute such content for platform operation purposes.
Additional content rules may apply within individual platform policies.

## 8. AI and Technology Systems
Azonova may provide access to AI-powered tools and digital automation systems.
Users agree that:
* AI-generated outputs may contain inaccuracies
* AI systems must not be used for unlawful or harmful purposes
* AI outputs must be independently verified when used commercially or publicly
Separate policies may govern responsible AI usage for specific platforms.

## 9. Third-Party Services
Azonova services may integrate or link to third-party platforms, tools, or services.
The Company does not control and is not responsible for:
* third-party content
* external services
* external privacy practices
Users interact with third-party services at their own risk.

## 10. Privacy
Use of Azonova services is also governed by our Privacy Policy, which explains how user data is collected, processed, and protected.

## 11. Service Availability
Azonova does not guarantee that services will always be:
* uninterrupted
* secure
* error-free
* continuously available
We may modify, suspend, or discontinue services at any time for operational or technical reasons.

## 12. Limitation of Liability
To the maximum extent permitted by law, Azonova Technologies Private Limited shall not be liable for:
* indirect or consequential damages
* loss of profits or business opportunities
* data loss
* service interruptions
* inaccuracies in platform content or AI outputs
Use of the services is at the user’s own risk.

## 13. Indemnification
Users agree to indemnify and hold harmless Azonova Technologies Private Limited, its directors, employees, and partners from any claims, liabilities, or damages arising from:
* misuse of services
* violation of these Terms
* infringement of intellectual property rights
* unlawful activities conducted through the platform

## 14. Suspension or Termination
Azonova may suspend or terminate user access if:
* these Terms are violated
* illegal or harmful activity is detected
* system security is compromised
The Company may also remove content that violates platform policies.

## 15. Changes to Terms
Azonova reserves the right to update or modify these Terms at any time.
Updated versions will be posted on the official website and continued use of services constitutes acceptance of the revised Terms.

## 16. Governing Law
These Terms shall be governed by and interpreted in accordance with the laws of India.
Any disputes arising from these Terms shall fall under the jurisdiction of the competent courts where Azonova Technologies Private Limited is registered.

## 17. Contact Information
For questions regarding these Terms, users may contact:
**Azonova Technologies Private Limited**
**Email:** info@tunetalez.com
**Address:** Innov8 Prestige Tech Platina, 11th Floor No. 32/2, 34/1 Kadabisanahalli, Vartur, Bangalore, Bangalore South, Karnataka, India, 560087
        `
    },
    {
        id: 'privacy-policy',
        title: 'Privacy Policy',
        icon: <Shield className="w-5 h-5" />,
        content: `
# Privacy Policy

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

## 1. Introduction
This Privacy Policy explains how Azonova Technologies Private Limited (“Azonova”, “Company”, “we”, “our”, or “us”) collects, uses, processes, and protects personal information when individuals access or use our:
* websites
* digital platforms
* mobile applications
* AI-driven services
* creator ecosystems
* technology infrastructure and related services
By accessing or using our services, users consent to the practices described in this Privacy Policy.

## 2. Scope of This Policy
This Privacy Policy applies to all digital products and services developed, owned, or operated by Azonova, including technology platforms within the Azonova ecosystem.
Some services may have additional platform-specific privacy terms that supplement this policy.

## 3. Information We Collect
Azonova may collect the following categories of information.

### 3.1 Personal Information
Information that identifies or can reasonably identify an individual, including:
* full name
* email address
* phone number
* account credentials
* billing information
* professional or creator profile information
* photos, voices and other personal details

### 3.2 Technical Information
When users access our services, we may automatically collect technical information such as:
* IP address
* browser type
* device information
* operating system
* access timestamps
* pages visited
* usage behavior on our platforms

### 3.3 Content and User Submissions
When users interact with Azonova platforms, we may collect:
* uploaded content
* creative submissions
* comments or messages
* AI prompts or generated outputs
* media files

### 3.4 Transaction Information
If users purchase subscriptions or services, we may collect:
* payment records
* transaction history
* subscription details
Payment processing may be handled by secure third-party payment processors.

## 4. How We Collect Information
We collect information through:
* user registrations and account creation
* forms and submissions on our platforms
* interactions with digital services
* automated technologies such as cookies and analytics tools
* communications with our support teams
* integration with third-party services

## 5. How We Use Information
Azonova uses collected information for the following purposes:
* **Platform Operation**: creating and managing user accounts, providing digital services, enabling creator ecosystems.
* **Service Improvement**: improving performance, training and optimizing technology systems, enhancing AI tools.
* **Communication**: responding to inquiries, sending service updates or important notifications.
* **Security and Fraud Prevention**: detecting suspicious activities, protecting system integrity, enforcing policies.
* **Legal Compliance**: complying with laws, responding to lawful requests.

## 6. Legal Basis for Processing
Azonova processes personal information based on:
* user consent
* performance of contractual obligations
* legitimate business interests
* legal compliance requirements

## 7. Data Sharing and Disclosure
Azonova does not sell personal information. Information may be shared with:
* **Service Providers**: Trusted third parties for hosting, analytics, payment processing, infrastructure.
* **Business Partners**: When necessary for platform services or projects.
* **Legal Authorities**: When required by law, regulatory authorities, court orders, or agencies.

## 8. Data Security
Azonova implements safeguards including:
* encryption of sensitive data
* secure cloud infrastructure
* access control mechanisms
* internal security policies

## 9. Data Retention
Personal information is retained only as long as necessary to provide services, fulfill obligations, or comply with laws.

## 10. User Rights
Users may have the right to:
* access their personal data
* request correction or deletion
* withdraw consent
* restrict or object to certain uses

## 11. Cookies and Tracking Technologies
Detailed information is provided in the Cookie Policy.

## 12. Third-Party Links
The Company is not responsible for the privacy practices of external platforms.

## 13. Children’s Privacy
Azonova services are not intended for children under 13 without parental supervision.

## 14. International Data Transfers
Information may be transferred to and processed in jurisdictions where our infrastructure or providers operate.

## 15. Updates
Updated policies will be posted on official platforms with the revised “Last Updated” date.

## 16. Contact Information
**Azonova Technologies Private Limited**
**Email:** info@tunetalez.com
**Address:** Innov8 Prestige Tech Platina, 11th Floor No. 32/2, 34/1 Kadabisanahalli, Vartur, Bangalore, Bangalore South, Karnataka, India, 560087
        `
    },
    {
        id: 'cookie-policy',
        title: 'Cookie Policy',
        icon: <FileText className="w-5 h-5" />,
        content: `
# Cookie Policy

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

## 1. Introduction
This Cookie Policy explains how Azonova Technologies Private Limited uses cookies and similar tracking technologies. By continuing to use Azonova services, users consent to the use of cookies as described here.

## 2. What Are Cookies
Cookies are small text files stored on a user’s device to help websites recognize users, remember preferences, and improve functionality.

## 3. Types of Cookies We Use
* **Essential Cookies**: Necessary for basic functioning like secure login and navigation.
* **Performance and Analytics Cookies**: Help us understand user interaction and improve usability.
* **Functional Cookies**: Remember preferences like language or region settings.
* **Advertising and Marketing Cookies**: Deliver relevant advertisements and measure campaign effectiveness.

## 4. Third-Party Cookies
Some cookies may be placed by trusted third-party providers for analytics, payment systems, or marketing.

## 5. How Cookies Are Used
Used to maintain secure sessions, recognize returning users, improve speed, analyze engagement, and personalize experience.

## 6. Managing Cookies
Users can control or disable cookies through browser settings, though this may affect service functionality.

## 7. Cookie Retention
* **Session cookies**: Deleted when browser is closed.
* **Persistent cookies**: Stored until expiration or manual deletion.

## 8. Updates
Revised versions will be published with an updated “Last Updated” date.

## 9. Contact Information
**Email:** info@tunetalez.com
**Address:** Innov8 Prestige Tech Platina, Bangalore, India, 560087
        `
    },
    {
        id: 'acceptable-use',
        title: 'Acceptable Use Policy',
        icon: <AlertTriangle className="w-5 h-5" />,
        content: `
# Acceptable Use Policy

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

Detailed rules and standards governing access to Azonova's platforms and services.

## 1. Prohibited Activities
* **Illegal Activities**: Distributing illegal material, fraud, hate speech, or pornographic content.
* **Platform Abuse**: Unauthorized access, interfering with functionality, or reverse engineering software.
* **Harmful Conduct**: Harassment, threats, misinformation, or violating rights of others.
* **IP Violations**: Infringing copyrights or trademarks.
* **AI Misuse**: Generating misleading or unlawful content using AI tools.
* **Malicious Software**: Introducing viruses, malware, or bots.

## 2. Enforcement
Azonova may monitor activity, investigate violations, and remove harmful content. Violations may result in content removal, account suspension, or legal action.

## 3. Contact for Reports
**Email:** info@tunetalez.com
        `
    },
    {
        id: 'copyright-ip',
        title: 'Copyright & IP Policy',
        icon: <Landmark className="w-5 h-5" />,
        content: `
# Copyright and Intellectual Property Policy

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

## 1. Ownership
* **Company IP**: All software, algorithms, branding, and assets are owned by Azonova.
* **User Content**: Users retain ownership of original content but grant Azonova a license to host and distribute it for platform operation.

## 2. Restrictions
Users may not reproduce proprietary materials, reverse engineer technologies, or misuse company branding.

## 3. Infringement (DMCA)
Azonova respects IP rights. Credible reports of infringement will result in content removal and potential account termination.

## 4. Contact
**Email:** info@tunetalez.com
        `
    },
    {
        id: 'grievance-redressal',
        title: 'Grievance Redressal Policy',
        icon: <BookOpen className="w-5 h-5" />,
        content: `
# Grievance Redressal Policy

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

Process for users to submit complaints regarding services, content, or policy violations.

## 1. Submission
Grievances can be submitted with full details to the designated Grievance Officer.

## 2. Resolution
The company aims to acknowledge and resolve grievances in a fair and timely manner.

## 3. Contact
**Grievance Officer**: info@tunetalez.com
        `
    },
    {
        id: 'data-retention',
        title: 'Data Retention Policy',
        icon: <Database className="w-5 h-5" />,
        content: `
# Data Retention Policy

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

## 1. Retention Principles
Data is retained only as long as necessary for platform operation, legal compliance, or security.

## 2. Categories
* **Account Data**: Retained for account duration.
* **Usage Data**: Used for performance and security.
* **Content**: Retention depends on platform needs and law.
* **Billing Data**: Retained for financial regulation periods.

## 3. Deletion
Users can request account deletion; data will be removed or anonymized unless legal retention is required.
        `
    },
    {
        id: 'security-practices',
        title: 'Security Practices Policy',
        icon: <Lock className="w-5 h-5" />,
        content: `
# Security Practices Policy

**Azonova Technologies Private Limited**
**Last Updated: 09.03.2026**

Detailed measures to protect digital infrastructure and data assets.

## 1. Measures
* Encryption of sensitive data.
* Secure network firewalls and multi-factor authentication.
* Role-based access controls.
* Regular security audits and vulnerability assessments.

## 2. User Responsibilities
Users must protect credentials and report suspicious activity.
        `
    },
    {
        id: 'ai-usage',
        title: 'AI Usage Policy',
        icon: <Cpu className="w-5 h-5" />,
        content: `
# AI Usage Policy

**OkVevo Platform**
**Last Updated: 09.03.2026**

## 1. Responsibility
Users must use AI tools ethically and legally. Users are solely responsible for AI-generated outputs and must verify accuracy before public distribution.

## 2. Prohibited Uses
Do not use AI for impersonation, generating harmful misinformation, or infringing intellectual property.

## 3. Safeguards
OkVevo implements automated moderation and filtering to maintain safety.
        `
    },
    {
        id: 'ai-content-ownership',
        title: 'AI Content Ownership',
        icon: <ImageIcon className="w-5 h-5" />,
        content: `
# AI Generated Content Ownership Policy

**OkVevo Platform**
**Last Updated: 09.03.2026**

## 1. Ownership
Users generally retain ownership of the content they generate using OkVevo AI tools, including final outputs and prompts, subject to platform policies.

## 2. Platform License
Users grant OkVevo a limited license to store, process, and display generated content for operational purposes.
        `
    },
    {
        id: 'responsible-ai',
        title: 'Responsible AI Policy',
        icon: <Sparkles className="w-5 h-5" />,
        content: `
# Responsible AI Policy

**OkVevo Platform**
**Last Updated: 09.03.2026**

## 1. Principles
OkVevo is committed to:
* **Safety & Reliability**: Minimizing harmful outcomes.
* **Fairness**: Evaluating systems for bias.
* **Transparency**: Informing users of AI involvement.
* **Privacy**: Minimizing unnecessary data use in AI processing.
        `
    },
    {
        id: 'marketplace',
        title: 'Marketplace Policy',
        icon: <ShoppingBag className="w-5 h-5" />,
        content: `
# Marketplace Policy

**OkVevo Platform**
**Last Updated: 09.03.2026**

## 1. Governance
Governs listing, purchasing, and licensing digital assets on the OkVevo Marketplace.

## 2. Responsibilities
* **Creators**: Must own rights to listed content and provide accurate descriptions.
* **Buyers**: Must comply with license terms and avoid unauthorized redistribution.

## 3. Revenue
Marketplace transactions involve revenue sharing and platform fees as defined in individual listings.
        `
    },
    {
        id: 'copyright-dmca',
        title: 'Copyright / DMCA Policy',
        icon: <Copyright className="w-5 h-5" />,
        content: `
# Copyright / DMCA Policy

**OkVevo Platform**
**Last Updated: 09.03.2026**

Procedures for reporting copyright infringement.

## 1. Takedown
Notices should include identification of work and infringing location. OkVevo will disable access to infringing material upon valid notice.

## 2. Counter-Notice
Users can submit counter-notices if they believe material was removed in error.
        `
    },
    {
        id: 'subscription-billing',
        title: 'Subscription & Billing',
        icon: <CreditCard className="w-5 h-5" />,
        content: `
# Subscription & Billing Policy

**OkVevo Platform**
**Last Updated: 09.03.2026**

Governs recurring billing cycles, payment methods, and automatic renewals for OkVevo subscription plans.

## 1. Renewals
Subscriptions automatically renew unless canceled before the next cycle.

## 2. Cancellations
Users can cancel anytime; access continues until the end of the current paid period.
        `
    },
    {
        id: 'refund-policy',
        title: 'Refund Policy',
        icon: <RefreshCw className="w-5 h-5" />,
        content: `
# Refund Policy

**OkVevo Platform**
**Last Updated: 09.03.2026**

## 1. Conditions
Subscription fees are generally non-refundable once the cycle starts. Digital products already accessed may not be eligible for refunds.

## 2. Exceptions
Refunds may be issued for duplicate charges or accidental payments if reported promptly.
        `
    },
    {
        id: 'api-terms',
        title: 'API Terms of Use',
        icon: <Code className="w-5 h-5" />,
        content: `
# API Terms of Use

**Ok Vevo Platform**
**Last Updated: 09.03.2026**

## 1. Use Case
Governs access to OkVevo APIs for developers to build integrations or tools.

## 2. Restrictions
Do not scrape data, bypass security, or replicate core platform functionality. Rate limits apply to all endpoints.
        `
    }
];

export default function LegalPage() {
    const [activePolicy, setActivePolicy] = useState(policies[0].id);

    useEffect(() => {
        // Handle anchor links if any
        if (window.location.hash) {
            const id = window.location.hash.replace('#', '');
            if (policies.some(p => p.id === id)) {
                setActivePolicy(id);
            }
        }
    }, []);

    return (
        <div className="bg-black min-h-screen text-white font-ubuntu flex flex-col relative overflow-x-hidden">
            {/* Grid Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div 
                    className="absolute inset-0 opacity-[0.20]" 
                    style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
                        backgroundSize: '40px 40px'
                    }} 
                />
                <div className="absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_0%,black_100%)] opacity-80" />
            </div>

            <DashNavbar />

            <main className="relative z-10 pt-44 pb-32 px-6 md:px-12 flex flex-col lg:flex-row gap-12 max-w-[1440px] mx-auto w-full">
                {/* Left Sidebar - Navigation */}
                <aside className="lg:w-80 flex-shrink-0">
                    <div className="sticky top-44 bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                        <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-8 ml-4">Legal & Policy</h2>
                        <nav className="flex flex-col gap-2">
                            {policies.map((policy) => (
                                <button
                                    key={policy.id}
                                    onClick={() => {
                                        setActivePolicy(policy.id);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 text-left group ${
                                        activePolicy === policy.id 
                                            ? 'bg-accent-orange text-white shadow-[0_10px_30px_rgba(251,74,46,0.3)]' 
                                            : 'hover:bg-white/5 text-white/60 hover:text-white'
                                    }`}
                                >
                                    <span className={`transition-colors duration-300 ${activePolicy === policy.id ? 'text-white' : 'text-white/40 group-hover:text-white'}`}>
                                        {policy.icon}
                                    </span>
                                    <span className="text-[13px] font-bold tracking-tight leading-tight">{policy.title}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* Right Content Area */}
                <div className="flex-1 bg-[#111111]/40 backdrop-blur-sm border border-white/5 rounded-[48px] p-8 md:p-16 min-h-[80vh]">
                    <div className="max-w-3xl mx-auto prose prose-invert prose-orange">
                        {/* Custom markdown-like rendering for the simple bolded parts */}
                        {policies.find(p => p.id === activePolicy)?.content.split('\n').map((line, index) => {
                            if (line.startsWith('# ')) {
                                return <h1 key={index} className="text-4xl md:text-5xl font-black mb-8 tracking-tighter text-white">{line.replace('# ', '')}</h1>;
                            }
                            if (line.startsWith('## ')) {
                                return <h2 key={index} className="text-xl md:text-2xl font-black mt-12 mb-6 tracking-tight text-accent-orange">{line.replace('## ', '')}</h2>;
                            }
                            if (line.startsWith('### ')) {
                                return <h3 key={index} className="text-lg font-black mt-8 mb-4 text-white">{line.replace('### ', '')}</h3>;
                            }
                            if (line.startsWith('* ')) {
                                return <li key={index} className="ml-6 text-white/70 mb-2 list-none flex gap-3">
                                    <span className="text-accent-orange">•</span>
                                    <span>{line.replace('* ', '')}</span>
                                </li>;
                            }
                            if (line.trim() === '') return <br key={index} />;
                            
                            // Handling bold text within lines
                            const parts = line.split('**');
                            return (
                                <p key={index} className="text-[15px] leading-relaxed text-white/80 mb-4">
                                    {parts.map((part, i) => i % 2 === 1 ? <strong key={part + i} className="text-white font-bold">{part}</strong> : part)}
                                </p>
                            );
                        })}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
