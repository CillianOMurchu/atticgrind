import { compose, roll, ollie, kickflip, shuvit, handstand } from './skate-moves';
import { SkaterConfig } from './skater';

export const SKATER_PROFILES: SkaterConfig[] = [
  // Foreground — full size, ollie into kickflip into handstand
  {
    sequence: compose(roll(40), ollie, roll(35), kickflip, roll(30), handstand, roll(40)),
    delay: 0,
    scale: 1.0,
    alpha: 1.0,
    laneOffset: 0,
  },
  // Near-mid — enters late, double shuvit with ollie in between
  {
    sequence: compose(roll(25), shuvit, roll(40), ollie, roll(30), shuvit, roll(25)),
    delay: 30,
    scale: 0.78,
    alpha: 0.70,
    laneOffset: 22,
  },
  // Mid — quick entry, kickflip then handstand then ollie out
  {
    sequence: compose(roll(55), kickflip, roll(25), handstand, roll(30), ollie, roll(30)),
    delay: 55,
    scale: 0.62,
    alpha: 0.52,
    laneOffset: 44,
  },
  // Mid-back — slightly ahead of skater 2, ollie into shuvit into kickflip
  {
    sequence: compose(roll(15), ollie, roll(45), shuvit, roll(20), kickflip, roll(40)),
    delay: 12,
    scale: 0.70,
    alpha: 0.60,
    laneOffset: 34,
  },
  // Far background — small and dim, handstand then ollie
  {
    sequence: compose(roll(30), handstand, roll(50), ollie, roll(35)),
    delay: 75,
    scale: 0.46,
    alpha: 0.35,
    laneOffset: 62,
  },
];
