import React, { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Edit2, Image as ImageIcon, Upload } from 'lucide-react';
import type { AppDispatch, RootState } from '../../store';
import { setImage } from '../../store/imagesSlice';
import WidgetShell from './WidgetShell';

interface ImageWidgetProps {
  widgetId: string;
}

const MAX_SIDE = 1400;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  });
}

const ImageWidget: React.FC<ImageWidgetProps> = ({ widgetId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const imageData = useSelector((s: RootState) => s.images.images[widgetId]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(imageData?.caption ?? '');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await compressImage(file);
    dispatch(setImage({ id: widgetId, data: { src, caption: imageData?.caption } }));
    e.target.value = '';
  };

  const saveCaption = () => {
    if (imageData) {
      dispatch(setImage({ id: widgetId, data: { ...imageData, caption: captionDraft } }));
    }
    setEditingCaption(false);
  };

  return (
    <WidgetShell title="Image" icon={<ImageIcon size={14} />}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {imageData?.src ? (
        <div className="dash-image-view">
          <img
            src={imageData.src}
            alt={imageData.caption ?? 'Vision board'}
            className="dash-image-img"
            onClick={() => fileRef.current?.click()}
            title="Click to replace the image"
          />
          <div className="dash-image-caption-row">
            {editingCaption ? (
              <>
                <input
                  type="text"
                  className="dash-image-caption-input"
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCaption();
                    if (e.key === 'Escape') setEditingCaption(false);
                  }}
                  autoFocus
                  placeholder="Add a caption..."
                />
                <button type="button" className="dash-image-caption-save" onClick={saveCaption}>
                  ✓
                </button>
              </>
            ) : (
              <>
                <span
                  className="dash-image-caption-text"
                  onClick={() => { setCaptionDraft(imageData.caption ?? ''); setEditingCaption(true); }}
                >
                  {imageData.caption || (
                    <em style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 11 }}>
                      Add a caption…
                    </em>
                  )}
                </span>
                <button
                  type="button"
                  className="dash-image-caption-edit"
                  onClick={() => { setCaptionDraft(imageData.caption ?? ''); setEditingCaption(true); }}
                  title="Edit caption"
                  aria-label="Edit caption"
                >
                  <Edit2 size={10} />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="dash-image-empty" onClick={() => fileRef.current?.click()}>
          <div className="dash-image-empty-icon">
            <Upload size={28} />
          </div>
          <p className="dash-image-empty-label">Click to add an image</p>
          <p className="dash-image-empty-sub">PNG, JPG, WebP — stored locally in your browser</p>
        </div>
      )}
    </WidgetShell>
  );
};

export default ImageWidget;
