import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OAUTH_SCOPE = 'atproto transition:generic transition:chat.bsky blob:*/*';

function normalizeSiteUrl(value) {
  if (!value) return '';

  return value.trim().replace(/\/+$/g, '');
}

function getGithubPagesSiteUrl() {
  const repository = process.env.GITHUB_REPOSITORY;
  const owner = process.env.GITHUB_REPOSITORY_OWNER;

  if (!repository || !owner) return '';

  const repoName = repository.split('/')[1];

  if (!repoName) return '';
  if (repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`)
    return `https://${owner}.github.io`;

  return `https://${owner}.github.io/${repoName}`;
}

const configuredClientId = process.env.NEXT_PUBLIC_ATPROTO_CLIENT_ID;
const siteUrl = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_URL ??
    getGithubPagesSiteUrl()
);

if (!siteUrl || configuredClientId) process.exit(0);

const metadataUrl = `${siteUrl}/oauth/client-metadata.json`;
const metadata = {
  client_id: metadataUrl,
  client_name: 'Twitter Clone',
  client_uri: siteUrl,
  redirect_uris: [`${siteUrl}/`],
  scope: OAUTH_SCOPE,
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
  application_type: 'web',
  dpop_bound_access_tokens: true
};
const outDir = path.join(process.cwd(), 'public', 'oauth');
const outFile = path.join(outDir, 'client-metadata.json');

await mkdir(outDir, { recursive: true });
await writeFile(outFile, `${JSON.stringify(metadata, null, 2)}\n`);
