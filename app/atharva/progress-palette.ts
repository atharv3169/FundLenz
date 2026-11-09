import { stories } from "./stories-data";

// One ordered palette powers both the overview ribbon and the reading pages.
// Color stops always come from the actual ten project accent colors.
export const storySpectrum = `linear-gradient(90deg, ${stories.map((story,index)=>
  `${story.accent} ${(index*100/(stories.length-1)).toFixed(3)}%`
).join(", ")})`;

export const storyProgress = (storyIndex:number,readFraction:number)=>
  Math.max(0,Math.min(1,(storyIndex+Math.max(0,Math.min(1,readFraction)))/stories.length));
