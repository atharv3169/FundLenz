import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import "../../app/atharva/route.css";
import PortfolioExperience from "../../app/atharva/portfolio-v2";
import StoryDetail from "../../app/atharva/story-detail";
import { stories } from "../../app/atharva/stories-data";

const slug=window.location.pathname.match(/^\/atharva\/stories\/([^/]+)\/?$/)?.[1];
const story=stories.find(item=>item.id===slug);
createRoot(document.getElementById("root")!).render(story?<StoryDetail story={story}/>:<PortfolioExperience/>);
