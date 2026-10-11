import { useMediaQuery } from '@mantine/hooks';

/**
 * Phones (portrait or landscape): the time controls dock under the views and the settings can be
 * hidden. Keep in step with the matching media queries in index.css and Transport.module.css.
 */
export const PHONE_QUERY = '(max-width: 700px), (max-height: 500px)';

/** Portrait phones: the Moon disc gets its own row under the views. */
export const PORTRAIT_PHONE_QUERY = '(max-width: 700px)';

export function useMediaMatch(query: string): boolean {
  return useMediaQuery(query, false, { getInitialValueInEffect: false });
}
