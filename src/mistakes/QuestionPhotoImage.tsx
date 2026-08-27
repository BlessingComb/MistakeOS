import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { resolveQuestionPhotoUri } from './photoStorage';

type Props = Omit<ImageProps, 'source'> & { uri: string };

export function QuestionPhotoImage({ uri, ...props }: Props) {
  const [resolvedUri, setResolvedUri] = useState(uri);

  useEffect(() => {
    let active = true;
    resolveQuestionPhotoUri(uri).then((nextUri: string) => { if (active) setResolvedUri(nextUri); });
    return () => { active = false; };
  }, [uri]);

  return <Image {...props} source={{ uri: resolvedUri }} />;
}
