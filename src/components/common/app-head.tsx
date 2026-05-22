import Head from 'next/head';
import { absolutePublicAsset, publicAsset } from '@lib/assets';
import { DEFAULT_SEO_IMAGE } from './seo';

export function AppHead(): JSX.Element {
  const absoluteImage = absolutePublicAsset(DEFAULT_SEO_IMAGE);

  return (
    <Head>
      <title>Not Twitter</title>
      <meta property='og:title' content='Not Twitter' key='og:title' />
      <meta property='og:image' content={absoluteImage} key='og:image' />
      <meta name='twitter:image' content={absoluteImage} key='twitter:image' />
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
