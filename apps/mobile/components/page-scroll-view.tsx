import { forwardRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { SiteFooter } from './site-footer';

/** Normal pages own one scroll surface, with the footer after their last content item. */
export const PageScrollView = forwardRef<ScrollView, ScrollViewProps>(function PageScrollView(
  { children, ...props },
  ref,
) {
  return (
    <ScrollView {...props} ref={ref}>
      {children}
      {!props.horizontal && <SiteFooter />}
    </ScrollView>
  );
});
