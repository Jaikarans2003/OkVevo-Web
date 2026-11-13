'use client';

import Link from 'next/link';
import Navbar from '@/components/landing-page/Navbar';
import DrawnArt from '@/components/landing-page/DrawnArt';
import { niaDownloadUrls } from '@/lib/nia-downloads';
import '@/components/landing-page/okvevo-landing.css';

const { mac: MAC_DOWNLOAD_URL, win: WINDOWS_DOWNLOAD_URL } = niaDownloadUrls();

const CARD =
  'group flex flex-col items-center gap-4 rounded-[28px] border-[1.5px] border-[#2a2a2a] bg-[#fbf7f1] px-8 py-9 no-underline shadow-[6px_6px_0_#2a2a2a] transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_#ff6f20] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#2a2a2a]';
const LOGO = 'h-11 w-11 text-[#2a2a2a] transition-colors group-hover:text-[#ff6f20]';

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={LOGO} aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function WindowsLogo() {
  return (
    <svg viewBox="0 0 88 88" fill="currentColor" className={LOGO} aria-hidden>
      <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349l-.011 41.34-47.318-6.678-.066-34.739z" />
    </svg>
  );
}

export default function OkVevoDownloadPage() {
  return (
    <div className="ok-landing flex min-h-screen flex-col md:h-dvh md:overflow-hidden">
      <Navbar />
      <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-6 pb-10 pt-28 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <h1 className="pb-4 text-5xl md:text-7xl">Hire OkVevo</h1>
          <p className="pb-8 text-lg text-[#4a4642]">Download OkVevo for Mac or Windows.</p>

          <div className="grid w-full gap-6 sm:grid-cols-2">
            <a href={MAC_DOWNLOAD_URL} className={CARD}>
              <AppleLogo />
              <span className="text-xl font-bold">Mac</span>
              <span className="text-sm text-[#7d776f]">Download .dmg</span>
            </a>

            <a href={WINDOWS_DOWNLOAD_URL} className={CARD}>
              <WindowsLogo />
              <span className="text-xl font-bold">Windows</span>
              <span className="text-sm text-[#7d776f]">Download installer</span>
            </a>
          </div>

          <p className="pt-16 text-sm text-[#7d776f]">
            Already have an account?{' '}
            <Link href="/login" className="!text-[#c2470b] hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mx-auto w-full max-w-[380px] md:max-w-none">
          <DrawnArt name="download" layers={6} width={1100} height={917} float={[4]}
            alt="An orange download arrow dropping into a laptop whose screen shows the app filling a progress bar" />
        </div>
      </main>
    </div>
  );
}
