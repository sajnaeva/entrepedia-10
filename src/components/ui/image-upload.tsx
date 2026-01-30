import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageSelect: (file: File) => void;
  onImageRemove?: () => void;
  uploading?: boolean;
  variant?: 'avatar' | 'cover';
  fallbackText?: string;
  className?: string;
}

export function ImageUpload({
  currentImageUrl,
  onImageSelect,
  onImageRemove,
  uploading = false,
  variant = 'avatar',
  fallbackText = 'U',
  className,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      onImageSelect(file);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onImageRemove?.();
  };

  const displayUrl = previewUrl || currentImageUrl;

  if (variant === 'cover') {
    return (
      <div className={cn('relative', className)}>
        <div
          className={cn(
            'h-32 rounded-lg bg-muted bg-cover bg-center relative overflow-hidden',
            !displayUrl && 'gradient-secondary'
          )}
          style={displayUrl ? { backgroundImage: `url(${displayUrl})` } : {}}
        >
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="absolute bottom-2 right-2 flex gap-2">
          {displayUrl && onImageRemove && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={handleRemove}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className={cn('relative inline-block', className)}>
      <Avatar className="h-20 w-20 ring-2 ring-background">
        <AvatarImage src={displayUrl || ''} />
        <AvatarFallback className="gradient-primary text-white text-2xl">
          {fallbackText.charAt(0)}
        </AvatarFallback>
      </Avatar>
      {uploading && (
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-white animate-spin" />
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Camera className="h-4 w-4" />
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
