import type { Route } from "./+types/home";
import { FramesList } from "../FramesList/FramesList";

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Source Frames [INSERT YOUR APP TITLE HERE]" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

export default function Home() {
	return (
		<main>
			<h1 className="text-6xl text-center p-6">Some Goofy AHHhhhh Title Here</h1>
	
			<FramesList />
	</main>);
}
