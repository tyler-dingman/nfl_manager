import { forwardRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

/** Native pages share one scroll surface; the app shell owns navigation. */
export const PageScrollView = forwardRef<ScrollView, ScrollViewProps>(function PageScrollView(
  { children, ...props },
  ref,
) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...props}
      ref={ref}
    >
      {children}
    </ScrollView>
  );
});
