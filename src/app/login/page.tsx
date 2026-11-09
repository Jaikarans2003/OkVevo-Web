import AuthForm from '@/components/shared/AuthForm';
import PortalShell from '@/components/portal/PortalShell';
import DrawnArt from '@/components/landing-page/DrawnArt';

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ redirect?: string; state?: string }>;
}) {
    const { redirect, state } = await searchParams;

    return (
        <PortalShell signedIn={false}>
            <section className="pt-auth">
                <div className="pt-auth-art sheet sheet--sand">
                    <DrawnArt name="login" layers={7} width={1100} height={917} float={[6]}
                        alt="An open door with warm light spilling onto the mat, a key floating beside it" />
                    <p className="hand">The door&apos;s open. <span>Come on in.</span></p>
                </div>
                <AuthForm desktopRedirect={redirect} desktopState={state} />
            </section>
        </PortalShell>
    );
}
