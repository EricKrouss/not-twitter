import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useUser } from '@lib/context/user-context';
import { useModal } from '@lib/hooks/useModal';
import { updateUserData } from '@lib/atproto/utils';
import { sleep } from '@lib/utils';
import { getImagesData } from '@lib/validation';
import { Modal } from '@components/modal/modal';
import { EditProfileModal } from '@components/modal/edit-profile-modal';
import {
  EditMediaModal,
  type EditableProfileMedia,
  type EditedProfileMedia
} from '@components/modal/edit-media-modal';
import { Button } from '@components/ui/button';
import { InputField } from '@components/input/input-field';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { FilesWithId } from '@lib/types/file';
import type { User, EditableData, EditableUserData } from '@lib/types/user';
import type { InputFieldProps } from '@components/input/input-field';

type RequiredInputFieldProps = Omit<InputFieldProps, 'handleChange'> & {
  inputId: EditableData;
};

type UserImages = Record<
  Extract<EditableData, 'photoURL' | 'coverPhotoURL'>,
  FilesWithId
>;

type TrimmedTexts = Pick<
  EditableUserData,
  Exclude<EditableData, 'photoURL' | 'coverPhotoURL'>
>;

type UserEditProfileProps = {
  hide?: boolean;
};

function revokeObjectURL(src?: string | null): void {
  if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
}

function getErrorMessage(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : null;
}

export function UserEditProfile({ hide }: UserEditProfileProps): JSX.Element {
  const { user } = useUser();
  const { open, openModal, closeModal } = useModal();

  const [loading, setLoading] = useState(false);

  const { bio, name, pronouns, website, photoURL, coverPhotoURL } =
    user as User;

  const [editUserData, setEditUserData] = useState<EditableUserData>({
    bio,
    name,
    pronouns,
    website,
    photoURL,
    coverPhotoURL
  });

  const [userImages, setUserImages] = useState<UserImages>({
    photoURL: [],
    coverPhotoURL: []
  });

  const [editingMedia, setEditingMedia] = useState<EditableProfileMedia | null>(
    null
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => cleanImage, []);

  const inputNameError = !editUserData.name?.trim()
    ? "Name can't be blank"
    : '';

  const updateData = async (): Promise<void> => {
    setLoading(true);

    try {
      const userId = user?.id as string;

      const newImages: Partial<Pick<User, 'photoURL' | 'coverPhotoURL'>> = {
        coverPhotoURL:
          coverPhotoURL === editUserData.coverPhotoURL
            ? coverPhotoURL
            : editUserData.coverPhotoURL,
        ...(userImages.photoURL.length && {
          photoURL: editUserData.photoURL as string
        })
      };

      const trimmedKeys: Readonly<EditableData[]> = [
        'name',
        'bio',
        'pronouns',
        'website'
      ];

      const trimmedTexts = trimmedKeys.reduce(
        (acc, curr) => ({ ...acc, [curr]: editUserData[curr]?.trim() ?? null }),
        {} as TrimmedTexts
      );

      const newUserData: Readonly<EditableUserData> = {
        ...editUserData,
        ...trimmedTexts,
        ...newImages
      };

      await sleep(500);

      await updateUserData(userId, newUserData, userImages);

      closeModal();

      cleanImage();

      setEditUserData(newUserData);

      toast.success('Profile updated successfully');
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(
        message
          ? `Profile could not be updated: ${message}`
          : 'Profile could not be updated'
      );
    } finally {
      setLoading(false);
    }
  };

  const editImage =
    (type: 'cover' | 'profile') =>
    ({ target }: ChangeEvent<HTMLInputElement>): void => {
      const { files } = target;
      const imagesData = getImagesData(files);

      if (!imagesData) {
        toast.error('Please choose a valid GIF or Photo');
        return;
      }

      const { imagesPreviewData, selectedImagesData } = imagesData;

      setEditingMedia({
        type,
        src: imagesPreviewData[0].src,
        alt: imagesPreviewData[0].alt,
        file: selectedImagesData[0]
      });

      target.value = '';
    };

  const removeCoverImage = (): void => {
    revokeObjectURL(editUserData.coverPhotoURL);

    setEditUserData({
      ...editUserData,
      coverPhotoURL: null
    });

    setUserImages({
      ...userImages,
      coverPhotoURL: []
    });
  };

  const cleanImage = (): void => {
    const imagesKey: Readonly<Partial<EditableData>[]> = [
      'photoURL',
      'coverPhotoURL'
    ];

    imagesKey.forEach((image) => revokeObjectURL(editUserData[image]));
    revokeObjectURL(editingMedia?.src);

    setUserImages({
      photoURL: [],
      coverPhotoURL: []
    });
  };

  const closeMediaEditor = (): void => {
    revokeObjectURL(editingMedia?.src);
    setEditingMedia(null);
  };

  const applyEditedImage = ({ previewSrc, file }: EditedProfileMedia): void => {
    if (!editingMedia) return;

    const targetKey =
      editingMedia.type === 'cover' ? 'coverPhotoURL' : 'photoURL';

    if (previewSrc !== editingMedia.src) revokeObjectURL(editingMedia.src);

    setEditUserData((currentEditUserData) => {
      revokeObjectURL(currentEditUserData[targetKey]);

      return {
        ...currentEditUserData,
        [targetKey]: previewSrc
      };
    });

    setUserImages((currentUserImages) => ({
      ...currentUserImages,
      [targetKey]: [file]
    }));

    setEditingMedia(null);
  };

  const resetUserEditData = (): void => {
    cleanImage();
    closeMediaEditor();
    setEditUserData({
      bio,
      name,
      pronouns,
      website,
      photoURL,
      coverPhotoURL
    });
  };

  const handleCloseModal = (): void => {
    closeMediaEditor();
    closeModal();
  };

  const handleChange =
    (key: EditableData) =>
    ({
      target: { value }
    }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditUserData({ ...editUserData, [key]: value });

  const handleKeyboardShortcut = ({
    key,
    target,
    ctrlKey
  }: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (ctrlKey && key === 'Enter' && !inputNameError) {
      target.blur();
      void updateData();
    }
  };

  const inputFields: Readonly<RequiredInputFieldProps[]> = [
    {
      label: 'Name',
      inputId: 'name',
      inputValue: editUserData.name,
      inputLimit: 50,
      errorMessage: inputNameError
    },
    {
      label: 'Bio',
      inputId: 'bio',
      inputValue: editUserData.bio,
      inputLimit: 160,
      useTextArea: true
    },
    {
      label: 'Pronouns',
      inputId: 'pronouns',
      inputValue: editUserData.pronouns,
      inputLimit: 20
    },
    {
      label: 'Website',
      inputId: 'website',
      inputValue: editUserData.website,
      inputLimit: 100
    }
  ];

  return (
    <form className={cn(hide && 'hidden md:block')}>
      <Modal
        modalClassName={cn(
          'relative w-full max-w-[600px] overflow-hidden rounded-2xl bg-main-background',
          editingMedia ? 'h-auto max-h-[90vh]' : 'h-[672px] max-h-[90vh]'
        )}
        open={open}
        closeModal={handleCloseModal}
      >
        {editingMedia ? (
          <EditMediaModal
            media={editingMedia}
            closeEditor={closeMediaEditor}
            applyImage={applyEditedImage}
          />
        ) : (
          <EditProfileModal
            name={name}
            loading={loading}
            photoURL={editUserData.photoURL}
            coverPhotoURL={editUserData.coverPhotoURL}
            inputNameError={inputNameError}
            editImage={editImage}
            closeModal={handleCloseModal}
            updateData={updateData}
            removeCoverImage={removeCoverImage}
            resetUserEditData={resetUserEditData}
          >
            {inputFields.map((inputData) => (
              <InputField
                {...inputData}
                handleChange={handleChange(inputData.inputId)}
                handleKeyboardShortcut={handleKeyboardShortcut}
                key={inputData.inputId}
              />
            ))}
          </EditProfileModal>
        )}
      </Modal>
      <Button
        className='dark-bg-tab self-start border border-light-line-reply px-4 py-1.5 font-bold
                   hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
        onClick={openModal}
      >
        Edit profile
      </Button>
    </form>
  );
}
