"use client";

import { useEffect } from "react";
import s from "./cursor-crew.module.css";
import { startLiveSwarm } from "./swarm-live-bridge.js";

export type MorphSignal={
 sequence:number;
 storyId:string;
 opening:boolean;
 originX:number;
 originY:number;
 apply:()=>void;
 finish:()=>void;
};

/** Host the actual Swarm Rebuild motion engine, not a custom reimplementation.
 * It creates a temporary pointer-events-none DOM layer on interaction only.
 */
export default function CursorCrew({signal}:{signal:MorphSignal|null}){
 useEffect(()=>{
  if(!signal)return;
  const instance=startLiveSwarm({signal,hostClass:s.layer});
  return ()=>instance.dispose();
 },[signal]);
 return null;
}
