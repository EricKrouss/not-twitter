import {
  HelpCenterHome,
  HelpCenterLayout
} from '@components/help/help-center-content';
import { SEO } from '@components/common/seo';
import type { ReactElement, ReactNode } from 'react';

export default function HelpCenter(): JSX.Element {
  return (
    <>
      <SEO
        title='Help Center / Not Twitter'
        description='Help for Not Twitter frontend messages, notices, errors, and Bluesky support links.'
      />
      <HelpCenterHome />
    </>
  );
}

HelpCenter.getLayout = (page: ReactElement): ReactNode => (
  <HelpCenterLayout>{page}</HelpCenterLayout>
);
