import Link from 'next/link';

import { PageHead } from '@/components/layout/PageHead';

export default function NotFound() {
  return (
    <>
      <PageHead label="Error 404" title="Page not found">
        This page doesn’t exist, or it has moved.
      </PageHead>
      <p className="px-10 py-12 text-[14px] tablet:px-6">
        <Link href="/" className="font-medium text-green underline underline-offset-2">
          Go to the home page
        </Link>
      </p>
    </>
  );
}
