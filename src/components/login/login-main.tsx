import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { NextImage } from '@components/ui/next-image';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';
import { Modal } from '@components/modal/modal';
import type { ChangeEvent, FormEvent } from 'react';

export function LoginMain(): JSX.Element {
  const { signInWithBluesky } = useAuth();
  const {
    open: signInOpen,
    openModal: openSignInModal,
    closeModal: closeSignInModal
  } = useModal();
  const [identifier, setIdentifier] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmedIdentifier = identifier.trim();

  const handleIdentifierChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => {
    setIdentifier(value);
    if (errorMessage) setErrorMessage('');
  };

  const handleModalClose = (): void => {
    if (loading) return;
    closeSignInModal();
    setErrorMessage('');
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!trimmedIdentifier) {
      setErrorMessage('Enter your Bluesky handle or DID.');
      return;
    }

    setLoading(true);

    try {
      await signInWithBluesky(trimmedIdentifier);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to start sign in.'
      );
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        modalClassName='relative flex min-h-[520px] w-full max-w-xl flex-col rounded-2xl bg-main-background px-8 py-4'
        open={signInOpen}
        closeModal={handleModalClose}
      >
        <form className='flex flex-1 flex-col' onSubmit={handleSignIn}>
          <div className='relative mb-8 flex min-h-[40px] items-center justify-center'>
            <Button
              className='absolute left-0 p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                         dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
              onClick={handleModalClose}
              disabled={loading}
            >
              <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
            </Button>
            <CustomIcon
              className='h-8 w-8 text-accent-blue dark:text-twitter-icon'
              iconName='TwitterIcon'
            />
          </div>
          <Dialog.Title className='mb-8 text-3xl font-bold'>
            Sign in to Not Twitter
          </Dialog.Title>
          <div className='flex flex-col gap-2'>
            <label
              className='relative rounded border border-light-line-reply transition focus-within:border-main-accent
                         focus-within:ring-1 focus-within:ring-main-accent dark:border-dark-border'
              htmlFor='bluesky-identifier'
            >
              <span className='absolute left-3 top-2 text-sm text-light-secondary dark:text-dark-secondary'>
                Bluesky handle or DID
              </span>
              <input
                className='mt-6 w-full bg-transparent px-3 pb-2 text-lg outline-none'
                id='bluesky-identifier'
                type='text'
                autoComplete='username'
                autoFocus
                value={identifier}
                onChange={handleIdentifierChange}
              />
            </label>
            {errorMessage && (
              <p className='text-sm text-accent-red'>{errorMessage}</p>
            )}
          </div>
          <div className='mt-auto flex flex-col gap-3 pb-2 inner:py-2 inner:font-bold'>
            <Button
              className='bg-light-primary text-white transition enabled:hover:bg-light-primary/90
                         enabled:focus-visible:bg-light-primary/90 enabled:active:bg-light-primary/80
                         disabled:brightness-75 dark:bg-light-border dark:text-light-primary
                         dark:enabled:hover:bg-light-border/90 dark:enabled:focus-visible:bg-light-border/90
                         dark:enabled:active:bg-light-border/75'
              type='submit'
              loading={loading}
              disabled={!trimmedIdentifier}
            >
              Next
            </Button>
          </div>
        </form>
      </Modal>
      <main className='grid lg:grid-cols-[1fr,45vw]'>
        <div className='relative hidden items-center justify-center  lg:flex'>
          <NextImage
            imgClassName='object-cover'
            blurClassName='bg-accent-blue'
            src='/assets/twitter-banner.png'
            alt='Not Twitter banner'
            layout='fill'
            useSkeleton
          />
          <i className='absolute'>
            <CustomIcon
              className='h-96 w-96 text-white'
              iconName='TwitterIcon'
            />
          </i>
        </div>
        <div className='flex flex-col items-center justify-between gap-6 p-8 lg:items-start lg:justify-center'>
          <i className='mb-0 self-center lg:mb-10 lg:self-auto'>
            <CustomIcon
              className='-mt-4 h-6 w-6 text-accent-blue lg:h-12 lg:w-12 dark:lg:text-twitter-icon'
              iconName='TwitterIcon'
            />
          </i>
          <div className='flex max-w-xs flex-col gap-4 font-twitter-chirp-extended lg:max-w-none lg:gap-16'>
            <h1
              className='text-3xl before:content-["See_what’s_happening_in_the_world_right_now."]
                         lg:text-6xl lg:before:content-["Happening_now"]'
            />
            <h2 className='hidden text-xl lg:block lg:text-3xl'>
              Join Not Twitter today.
            </h2>
          </div>
          <div className='flex w-full max-w-xs flex-col gap-3'>
            <a
              className='accent-tab flex min-h-[40px] items-center justify-center rounded-full bg-main-accent px-4
                         py-2 text-center font-bold text-white transition hover:bg-main-accent/90
                         focus-visible:bg-main-accent/90 active:bg-main-accent/80'
              href='https://bsky.app/'
              target='_blank'
              rel='noreferrer'
            >
              Create account
            </a>
            <p className='text-sm leading-5 text-light-secondary dark:text-dark-secondary'>
              Create your account on Bluesky, then come back here and sign in
              with your handle.
            </p>
            <p className='pt-8 font-bold'>Already have an account?</p>
            <Button
              className='border border-light-line-reply font-bold text-accent-blue transition hover:bg-accent-blue/10
                         focus-visible:bg-accent-blue/10 focus-visible:!ring-accent-blue/80 active:bg-accent-blue/20
                         dark:border-light-secondary'
              onClick={openSignInModal}
            >
              Sign in
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
