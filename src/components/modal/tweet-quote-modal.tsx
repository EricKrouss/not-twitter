import { Input } from '@components/input/input';
import type { TweetWithUser } from '@lib/types/tweet';

type TweetQuoteModalProps = {
  tweet: TweetWithUser;
  closeModal: () => void;
};

export function TweetQuoteModal({
  tweet,
  closeModal
}: TweetQuoteModalProps): JSX.Element {
  return <Input modal quoteTweet={tweet} closeModal={closeModal} />;
}
