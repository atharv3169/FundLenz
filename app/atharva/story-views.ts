import { stories, type StoryId } from "./stories-data";

// Per-browser completion state, separate from the saved paper theme.
export const EXPLORED_STORIES_KEY="atharva-explored-stories-v1";
export const EXPLORED_STORIES_CHANGED="atharva:explored-stories-changed";
const validIds=new Set<string>(stories.map(story=>story.id));
const isStoryId=(value:unknown):value is StoryId=>typeof value==="string"&&validIds.has(value);

export function readExploredStories():StoryId[]{
 try{
  const saved=localStorage.getItem(EXPLORED_STORIES_KEY);
  if(!saved)return [];
  const parsed:unknown=JSON.parse(saved);
  return Array.isArray(parsed)?[...new Set(parsed.filter(isStoryId))]:[];
 }catch{return []}
}

export function markStoryExplored(id:StoryId):void{
 try{
  if(!validIds.has(id))return;
  const seen=readExploredStories();
  if(seen.includes(id))return;
  localStorage.setItem(EXPLORED_STORIES_KEY,JSON.stringify([...seen,id]));
  window.dispatchEvent(new Event(EXPLORED_STORIES_CHANGED));
 }catch{
  // Privacy modes may block storage; story reading still works.
 }
}
