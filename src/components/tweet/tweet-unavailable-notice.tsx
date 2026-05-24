import {
  TweetTombstone,
  limitedVisibilityTweetMessage
} from './tweet-tombstone';

export { limitedVisibilityTweetMessage };

export function TweetUnavailableNotice({
  className
}: {
  className?: string;
}): JSX.Element {
  return <TweetTombstone kind='limited-visibility' className={className} />;
}
