import Head from 'next/head';
import { publicAsset } from '@lib/assets';

export function AppHead(): JSX.Element {
  return (
    <Head>
      <title>Not Twitter</title>
      <meta name='og:title' content='Not Twitter' />
      <link rel='icon' href={publicAsset('/favicon.ico')} />
      <link
        rel='manifest'
        href={publicAsset('/site.webmanifest')}
        key='site-manifest'
      />
      <meta name='twitter:site' content='@ccrsxx' />
      <meta name='twitter:card' content='summary_large_image' />
    </Head>
  );
}
