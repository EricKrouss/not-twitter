import TLDs from 'tlds';

const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g;
const URL_REGEX =
  /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim;
const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu;
const TAG_REGEX =
  /(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu;
const CASHTAG_REGEX =
  /(^|\s|\()\$([A-Za-z][A-Za-z0-9]{0,4})(?=\s|$|[.,;:!?)"'\u2019])/gu;

export function detectFacets(text) {
  let match;
  const facets = [];

  {
    const re = MENTION_REGEX;
    while ((match = re.exec(text.utf16))) {
      if (!isValidDomain(match[3]) && !match[3].endsWith('.test')) continue;

      const start = text.utf16.indexOf(match[3], match.index) - 1;
      facets.push({
        $type: 'app.bsky.richtext.facet',
        index: {
          byteStart: text.utf16IndexToUtf8Index(start),
          byteEnd: text.utf16IndexToUtf8Index(start + match[3].length + 1)
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: match[3]
          }
        ]
      });
    }
  }

  {
    const re = URL_REGEX;
    while ((match = re.exec(text.utf16))) {
      let uri = match[2];
      if (!uri.startsWith('http')) {
        const domain = match.groups?.domain;
        if (!domain || !isValidDomain(domain)) continue;

        uri = `https://${uri}`;
      }

      const start = text.utf16.indexOf(match[2], match.index);
      const index = { start, end: start + match[2].length };

      if (/[.,;:!?]$/.test(uri)) {
        uri = uri.slice(0, -1);
        index.end--;
      }

      if (/[)]$/.test(uri) && !uri.includes('(')) {
        uri = uri.slice(0, -1);
        index.end--;
      }

      facets.push({
        index: {
          byteStart: text.utf16IndexToUtf8Index(index.start),
          byteEnd: text.utf16IndexToUtf8Index(index.end)
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri
          }
        ]
      });
    }
  }

  {
    const re = TAG_REGEX;
    while ((match = re.exec(text.utf16))) {
      const leading = match[1];
      let tag = match[2];
      if (!tag) continue;

      tag = tag.trim().replace(TRAILING_PUNCTUATION_REGEX, '');
      if (tag.length === 0 || tag.length > 64) continue;

      const index = match.index + leading.length;
      facets.push({
        index: {
          byteStart: text.utf16IndexToUtf8Index(index),
          byteEnd: text.utf16IndexToUtf8Index(index + 1 + tag.length)
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#tag',
            tag
          }
        ]
      });
    }
  }

  {
    const re = CASHTAG_REGEX;
    while ((match = re.exec(text.utf16))) {
      const leading = match[1];
      let ticker = match[2];
      if (!ticker) continue;

      ticker = ticker.toUpperCase();
      const index = match.index + leading.length;
      facets.push({
        index: {
          byteStart: text.utf16IndexToUtf8Index(index),
          byteEnd: text.utf16IndexToUtf8Index(index + 1 + ticker.length)
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#tag',
            tag: `$${ticker}`
          }
        ]
      });
    }
  }

  return facets.length > 0 ? facets : undefined;
}

function isValidDomain(str) {
  return !!TLDs.find((tld) => {
    const i = str.lastIndexOf(tld);
    if (i === -1) return false;

    return str.charAt(i - 1) === '.' && i === str.length - tld.length;
  });
}
