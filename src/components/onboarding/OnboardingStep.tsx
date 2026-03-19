'use client';

import Image, { type StaticImageData } from 'next/image';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OnboardingStepProps = {
  illustration: StaticImageData;
  title: string;
  description: string;
  secondaryLine: string;
  currentStep: number;
  totalSteps: number;
  isFinalStep: boolean;
  onContinue: () => void;
  onSkip: () => void;
  primaryColor?: string | null;
  primaryTextColor?: string;
  className?: string;
  onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
};

export default function OnboardingStep({
  illustration,
  title,
  description,
  secondaryLine,
  currentStep,
  totalSteps,
  isFinalStep,
  onContinue,
  onSkip,
  primaryColor,
  primaryTextColor,
  className,
  onTouchStart,
  onTouchEnd,
}: OnboardingStepProps) {
  return (
    <div
      className={cn('flex h-full flex-col', className)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-center pt-1">
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <span
              key={`onboarding-dot-${index}`}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all duration-200',
                index === currentStep ? 'bg-slate-900' : 'bg-slate-200',
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="relative mx-auto mt-5 flex h-44 w-full max-w-[280px] items-center justify-center sm:mt-6 sm:h-52 sm:max-w-[320px]">
            <Image
              src={illustration}
              alt=""
              priority
              className="h-full w-full object-contain"
            />
          </div>

          <div className="mt-6 text-center sm:mt-7">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-700 sm:text-base">
              {description}
            </p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              {secondaryLine}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={onSkip}>
            Skip
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            style={
              primaryColor
                ? {
                    backgroundColor: primaryColor,
                    color: primaryTextColor ?? '#ffffff',
                  }
                : undefined
            }
            onClick={onContinue}
          >
            {isFinalStep ? 'Start Building' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
