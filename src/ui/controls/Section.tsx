import { Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/** A titled group of controls in the sidebar. */
export function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Stack component="section" gap="xs" p="sm">
      <Text component="h2" size="xs" fw={700} tt="uppercase" c="dimmed" m={0}>
        {title}
      </Text>
      {children}
    </Stack>
  );
}
