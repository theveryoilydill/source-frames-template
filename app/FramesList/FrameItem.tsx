export function FrameItem({ SourceData }: { SourceData?: { name: string; URL: string } }) {
	return (
		<div className="border">
			<h2>{SourceData?.name}</h2>
			<a href={SourceData?.URL} target="_blank" rel="noopener noreferrer">
				Visit Source
			</a>
		</div>
	);
}
