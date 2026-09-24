'use client';

/* Authenticated Crew media must be loaded with the viewer's cookies, not Next image optimization. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { Camera, Pencil, Upload } from 'lucide-react';
import { CrewDialog, crewRequest } from './crew-ui';
import styles from './crew-page.module.css';

export async function readPhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read photo.'));
    reader.readAsDataURL(file);
  });
}
export async function resizedPhoto(file: File) {
  const src = await readPhoto(file);
  const image = new Image();
  image.src = src;
  await image.decode();
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to prepare photo.'))),
      'image/jpeg',
      0.85,
    ),
  );
}
export async function uploadPhoto(blob: Blob) {
  const form = new FormData();
  form.append('photo', blob, 'crew-photo.jpg');
  return crewRequest('/api/crew/media', 'POST', form) as Promise<{ id: string; url: string }>;
}
export function CrewPhoto({
  url,
  canEdit,
  onSaved,
}: {
  url?: string | null;
  canEdit: boolean;
  onSaved: (url: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false),
    [source, setSource] = useState(''),
    [error, setError] = useState('');
  return (
    <div className={styles.photoWrap}>
      {url ? (
        <img className={styles.crewPhoto} src={url} alt="Crew photo" />
      ) : canEdit ? (
        <button className={styles.emptyPhoto} onClick={() => picker.current?.click()}>
          <Camera size={30} />
          <span>Upload Photo</span>
        </button>
      ) : (
        <div className={styles.emptyPhoto}>
          <Camera size={30} />
          <span>Crew photo</span>
        </div>
      )}
      {canEdit && (
        <>
          <input
            ref={picker}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload Crew photo"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setError('');
              try {
                setSource(await readPhoto(file));
                setMenu(false);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
          {url && (
            <button
              className={styles.photoEdit}
              aria-label="Edit Crew photo"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Camera size={20} />
            </button>
          )}
          {menu && (
            <div className={styles.photoMenu}>
              <button
                onClick={() => {
                  setSource(url!);
                  setMenu(false);
                }}
              >
                <Pencil size={16} />
                Edit Photo
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  picker.current?.click();
                }}
              >
                <Upload size={16} />
                Upload Photo
              </button>
            </div>
          )}
          {source && <PhotoEditor source={source} close={() => setSource('')} saved={onSaved} />}
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
function PhotoEditor({
  source,
  close,
  saved,
}: {
  source: string;
  close: () => void;
  saved: (url: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      if (active) setError('Unable to open photo. Try uploading a replacement.');
    };
    img.src = source;
    return () => {
      active = false;
    };
  }, [source]);
  useEffect(() => {
    if (!image || !canvas.current) return;
    const side = Math.min(image.width, image.height) / zoom;
    const left = ((image.width - side) * x) / 100,
      top = ((image.height - side) * y) / 100;
    const context = canvas.current.getContext('2d')!;
    context.clearRect(0, 0, 512, 512);
    context.drawImage(image, left, top, side, side, 0, 0, 512, 512);
  }, [image, zoom, x, y]);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.current!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Unable to crop photo.'))),
          'image/jpeg',
          0.9,
        ),
      );
      const media = await uploadPhoto(blob);
      await crewRequest('/api/crew', 'PATCH', { photoMediaId: media.id });
      saved(media.url);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <CrewDialog
      title="Edit Crew photo"
      close={() => {
        if (!busy) close();
      }}
    >
      <p className={styles.muted}>Adjust the crop and position, then save your Crew photo.</p>
      <canvas
        ref={canvas}
        width={512}
        height={512}
        className={styles.cropPreview}
        aria-label="Crew photo crop preview"
      />
      {[
        ['Zoom', zoom, setZoom, 1, 3, 0.05],
        ['Horizontal position', x, setX, 0, 100, 1],
        ['Vertical position', y, setY, 0, 100, 1],
      ].map(([label, value, setter, min, max, step]) => (
        <label key={String(label)} className={styles.field}>
          {String(label)}
          <input
            type="range"
            min={Number(min)}
            max={Number(max)}
            step={Number(step)}
            value={Number(value)}
            onChange={(e) => (setter as (n: number) => void)(Number(e.target.value))}
          />
        </label>
      ))}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button className={styles.primary} disabled={!image || busy} onClick={save}>
        {busy ? 'Saving…' : 'Save photo'}
      </button>
    </CrewDialog>
  );
}
