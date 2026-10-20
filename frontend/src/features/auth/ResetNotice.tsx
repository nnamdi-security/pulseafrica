'use client';

/* login.html's reset view: there's no password reset yet, and the page says so (FE-01). */
import { IconArrowLeft } from '@tabler/icons-react';
import { useRef } from 'react';

import { useArriveFocus, ViewHead, ViewLink } from './AuthShell';

export function ResetNotice() {
  const heading = useRef<HTMLHeadingElement>(null);
  useArriveFocus({ first: heading });
  return (
    <>
      <ViewLink href="/login" className="mb-[18px] inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-navy">
        <IconArrowLeft aria-hidden="true" size={15} /> Back to sign in
      </ViewLink>
      <ViewHead
        headingRef={heading}
        title="Reset your password"
        sub="Password reset isn't available yet. Contact an administrator to regain access to your account."
      />
    </>
  );
}
