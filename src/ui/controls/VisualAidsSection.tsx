import { Button, Group, Input, Slider } from '@mantine/core';
import { BODY_SIZE_RANGE, TRUE_SCALE } from '../../sim/visualScale';
import { useSimStore } from '../../state/store';
import { Section } from './Section';

/**
 * Moon-distance stops. Log-spaced: a linear 0.05–1 slider would spend 95% of its travel on the
 * uninteresting end. The slider moves over stop indices; 1× (true scale) is on the left.
 */
const DISTANCE_STOPS = [1, 0.5, 0.25, 0.1, 0.05] as const;

const BODY_SIZE_MARKS = [1, 5, 10, 15, 20, 25].map((value) => ({ value, label: `${value}×` }));
const DISTANCE_MARKS = DISTANCE_STOPS.map((stop, value) => ({ value, label: `${stop}×` }));

const nearestStop = (distance: number): number =>
  DISTANCE_STOPS.reduce(
    (best, stop, i) =>
      Math.abs(stop - distance) < Math.abs((DISTANCE_STOPS[best] ?? 1) - distance) ? i : best,
    0,
  );

export function VisualAidsSection() {
  const visualScale = useSimStore((s) => s.visualScale);
  const setVisualScale = useSimStore((s) => s.setVisualScale);

  return (
    <Section id="visual-aids" title="Visual aids — not true scale" defaultOpen>
      <Input.Wrapper label="Body size" description="Earth, Moon and Sun, in both views">
        <Slider
          mt={6}
          mb="lg"
          min={BODY_SIZE_RANGE.min}
          max={BODY_SIZE_RANGE.max}
          step={0.5}
          marks={BODY_SIZE_MARKS}
          label={(v) => `${v}×`}
          value={visualScale.bodySize}
          onChange={(bodySize) => {
            setVisualScale({ bodySize });
          }}
          thumbLabel="Body size"
        />
      </Input.Wrapper>
      <Input.Wrapper label="Moon distance" description="Brings the Moon closer to Earth">
        <Slider
          mt={6}
          mb="lg"
          min={0}
          max={DISTANCE_STOPS.length - 1}
          step={1}
          marks={DISTANCE_MARKS}
          restrictToMarks
          label={(i) => `${DISTANCE_STOPS[i] ?? 1}×`}
          value={nearestStop(visualScale.moonDistance)}
          onChange={(i) => {
            setVisualScale({ moonDistance: DISTANCE_STOPS[i] ?? 1 });
          }}
          thumbLabel="Moon distance"
        />
      </Input.Wrapper>
      <Group justify="flex-end">
        <Button
          variant="light"
          size="xs"
          disabled={
            visualScale.bodySize === TRUE_SCALE.bodySize &&
            visualScale.moonDistance === TRUE_SCALE.moonDistance
          }
          onClick={() => {
            setVisualScale(TRUE_SCALE);
          }}
        >
          Reset to true scale
        </Button>
      </Group>
    </Section>
  );
}
