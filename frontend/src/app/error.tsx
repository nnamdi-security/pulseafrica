'use client';

import { PageHead } from '@/components/layout/PageHead';

/** Shown when a page fails to render; the shell around it keeps working */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageHead label="Error" title="Something went wrong">
        Something went wrong on our side. Please try again.
      </PageHead>
      <p className="px-10 py-12 tablet:px-6">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm border border-input bg-white px-[22px] py-[9px] text-[13px] font-medium text-navy hover:border-gold"
        >
          Try again
        </button>
      </p>
    </>
  );
}
