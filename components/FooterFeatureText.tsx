'use client';

import { useRemoteConfig } from '@/lib/remoteConfigContext';

export function FooterFeatureText() {
  const { footer_feature_text } = useRemoteConfig();

  if (!footer_feature_text?.enabled) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground">{footer_feature_text.text}</p>
  );
}
export default FooterFeatureText;
