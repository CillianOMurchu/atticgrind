import { compose, roll } from './skate-moves';
import { SkaterConfig } from './skater';

export const SKATER_PROFILES: SkaterConfig[] = [
  {
    sequence: compose(roll(185)),
    delay: 0,
    scale: 1.0,
    alpha: 1.0,
    laneOffset: 0,
  },
];
