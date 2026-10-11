import { Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { ChevronRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { usePersistentFlag } from '../usePersistentFlag';
import classes from './Section.module.css';

interface Props {
  /** Storage key suffix for remembering open/closed per viewer. */
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A titled, collapsible group of sidebar controls; remembers whether it was left open. */
export function Section({ id, title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = usePersistentFlag(`moon-sim:panel:${id}`, defaultOpen);
  const bodyId = useId();

  return (
    <section>
      <UnstyledButton
        className={classes.header}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Group gap={6} wrap="nowrap">
          <ChevronRight
            size={14}
            aria-hidden
            className={classes.chevron}
            data-open={open || undefined}
          />
          <Text component="h2" size="xs" fw={700} tt="uppercase" c="dimmed" m={0}>
            {title}
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse expanded={open} transitionDuration={150}>
        <Stack id={bodyId} gap="xs" px="sm" pb="sm">
          {children}
        </Stack>
      </Collapse>
    </section>
  );
}
