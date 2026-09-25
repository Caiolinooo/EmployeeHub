export const TABLET_UA_SOURCE: string;
export const PHONE_HINT_SOURCE: string;
export const TABLET_UA_RE: RegExp;
export const PHONE_HINT_RE: RegExp;
export const PHONE_REWRITE_UA_VALUE: string;
export const TABLET_UA_VALUE: string;
export function isTabletUserAgent(ua: string | undefined | null): boolean;
export function isPhoneUserAgent(ua: string | undefined | null): boolean;
