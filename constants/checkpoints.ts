/**
 * Default checkpoint definitions for Palitana Yatra
 * 16 checkpoints across 2 days
 */

import { Checkpoint } from "@/types";

export const DEFAULT_CHECKPOINTS: Checkpoint[] = [
  // Day 1 - Ascent
  { id: 1, number: 1, description: "Base Camp - Start", day: 1 },
  { id: 2, number: 2, description: "First Rest Point", day: 1 },
  { id: 3, number: 3, description: "Adinath Temple Gate", day: 1 },
  { id: 4, number: 4, description: "Mid-way Dharamshala", day: 1 },
  { id: 5, number: 5, description: "Chaumukh Temple", day: 1 },
  { id: 6, number: 6, description: "Kumarpal Temple", day: 1 },
  { id: 7, number: 7, description: "Vimalshah Temple", day: 1 },
  { id: 8, number: 8, description: "Summit - Day 1 End", day: 1 },
  // Day 2 - Descent & Completion
  { id: 9, number: 9, description: "Morning Assembly", day: 2 },
  { id: 10, number: 10, description: "Sampriti Temple", day: 2 },
  { id: 11, number: 11, description: "Descent Start", day: 2 },
  { id: 12, number: 12, description: "Taleti Rest Point", day: 2 },
  { id: 13, number: 13, description: "Hastagiri Tirth", day: 2 },
  { id: 14, number: 14, description: "Final Dharamshala", day: 2 },
  { id: 15, number: 15, description: "Exit Gate", day: 2 },
  { id: 16, number: 16, description: "Base Camp - Completion", day: 2 },
];

export const TOTAL_CHECKPOINTS = 16;
