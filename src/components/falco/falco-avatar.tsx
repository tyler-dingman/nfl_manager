import { FiveWideLogo } from '@/components/branding/fivewide-logo';

type FalcoAvatarProps = {
  size?: number;
  className?: string;
};

export default function FalcoAvatar({ size = 28, className }: FalcoAvatarProps) {
  return (
    <FiveWideLogo
      size={Math.max(12, size - 16)}
      containerClassName={className}
      containerStyle={{ width: size, height: size }}
    />
  );
}
