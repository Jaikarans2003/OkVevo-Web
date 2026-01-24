import AuthForm from '../../components/AuthForm';

export default function LoginPage() {
    return (
        <main className="min-h-screen w-full flex items-center justify-center p-4 bg-custom-bg relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-custom-orange/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-custom-orange/5 rounded-full blur-[100px] animate-pulse delay-700" />
            </div>

            {/* Content */}
            <div className="relative z-10 w-full flex justify-center">
                <AuthForm />
            </div>
        </main>
    );
}
