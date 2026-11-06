export type StoryId = "shyam" | "fundlenz" | "research" | "fincalc" | "dcf" | "crowd" | "study" | "vs" | "synk";
export type Story={ id:StoryId; title:string; type:string; year:string; eyebrow:string; hook:string; intro:string; accent:string; numbers:{value:string;label:string}[]; chapters:{title:string;paragraphs:string[]}[]; tags:string[]; visit?:{href:string;text:string;pending?:boolean} };
export const stories:Story[]=[];
