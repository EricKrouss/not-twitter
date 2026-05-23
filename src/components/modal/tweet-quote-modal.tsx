import { Input } from '@components/input/input';
import type { TweetWithUser } from '@lib/types/tweet';

type TweetQuoteModalProps = {
  tweet: TweetWithUser;
  closeModal: () => void;
  onQuoteTweetSent?: (tweet: TweetWithUser) => void;
};

export function TweetQuoteModal({
  tweet,
  closeModal,
  onQuoteTweetSent
}: TweetQuoteModalProps): JSX.Element {
  return (
    <Input
      modal
      quoteTweet={tweet}
      closeModal={closeModal}
      onTweetSent={onQuoteTweetSent}
    />
  );
}
