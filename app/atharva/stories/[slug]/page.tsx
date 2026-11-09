import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { stories } from "../../stories-data";
import StoryDetail from "../../story-detail";
import "../../route.css";

type Props={params:Promise<{slug:string}>};

export function generateStaticParams(){
 return stories.map(story=>({slug:story.id}));
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;
 const story=stories.find(item=>item.id===slug);
 if(!story)return {title:"Project not found"};
 return {
   title:story.title+" — Atharva Sahu | Case Study",
   description:story.intro,
   robots:{index:false,follow:false},
   openGraph:{title:story.title+" — Atharva Sahu",description:story.intro,type:"article",url:"https://fundlenz.com/atharva/stories/"+story.id}
 };
}

export default async function StoryPage({params}:Props){
 const {slug}=await params;
 const story=stories.find(item=>item.id===slug);
 if(!story)notFound();
 return <StoryDetail story={story}/>;
}
