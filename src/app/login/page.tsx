import AuthForm from '../../components/AuthForm';
import NoiseOverlay from '../../components/NoiseOverlay';

export default function LoginPage() {
    return (
        <main className="min-h-screen w-full flex items-center justify-center p-4 bg-bg-main relative overflow-hidden">
            <NoiseOverlay />

            {/* Background Decorative Gradients */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-accent-orange/20 rounded-full blur-[150px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-orange/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Content */}
            <div className="relative z-10 w-full flex justify-center">
                <AuthForm />
            </div>
        </main>
    );
}
