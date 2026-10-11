import { Anchor, List, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { Section } from './Section';

const link = (href: string, children: ReactNode) => (
  <Anchor href={href} target="_blank" rel="noopener noreferrer" size="xs">
    {children}
  </Anchor>
);

/**
 * Data sources and software credits. Licence texts for every bundled package ship with the site as
 * third-party-licenses.md (generated at build time by Vite's `build.license`).
 */
export function CreditsSection() {
  const base = import.meta.env.BASE_URL;
  return (
    <Section id="credits" title="Credits">
      <List size="xs" spacing={6} c="dimmed">
        <List.Item>
          Earth: Blue Marble,{' '}
          {link('https://visibleearth.nasa.gov/images/73909', 'NASA Earth Observatory')} / Reto
          Stöckli
        </List.Item>
        <List.Item>
          Moon:{' '}
          {link(
            'https://svs.gsfc.nasa.gov/4720',
            "CGI Moon Kit, NASA's Scientific Visualization Studio",
          )}{' '}
          (LRO data)
        </List.Item>
        <List.Item>
          Positions, rotations, phases and eclipses:{' '}
          {link('https://github.com/cosinekitty/astronomy', 'Astronomy Engine')} by Don Cross
        </List.Item>
        <List.Item>
          Sky:{' '}
          {link(
            'https://github.com/takram-design-engineering/three-geospatial',
            'takram three-atmosphere',
          )}
          , after Eric Bruneton&apos;s precomputed atmospheric scattering
        </List.Item>
        <List.Item>Stars: Yale Bright Star Catalog, 5th ed. (Hoffleit &amp; Warren)</List.Item>
        <List.Item>
          Place search and names: {link('https://photon.komoot.io', 'Photon')} ·{' '}
          {link('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors')}
        </List.Item>
        <List.Item>
          Time zones:{' '}
          {link(
            'https://github.com/evansiroky/timezone-boundary-builder',
            'timezone-boundary-builder',
          )}{' '}
          (OpenStreetMap data, ODbL) via tz-lookup
        </List.Item>
        <List.Item>Built with React, three.js, React Three Fiber, Mantine and Lucide.</List.Item>
      </List>
      <Text size="xs" c="dimmed">
        moon-sim is MIT-licensed · {link(`${base}third-party-licenses.md`, 'Third-party licences')}
      </Text>
    </Section>
  );
}
