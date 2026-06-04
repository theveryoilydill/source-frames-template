import React, { useEffect } from "react";

type FrameContentProps = {
	url: string;
	onClose?: () => void;
	title?: string;
};

export default function FrameContent({ url, onClose, title }: FrameContentProps) {
	useEffect(() => {
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (onClose) onClose();
				else window.history.back();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = prevOverflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);

	if (!url) return null;

	return (
		<div className="fixed inset-0 z-[9999] flex flex-col bg-black/75">
			<div className="h-12 shrink-0 flex items-center justify-between px-3 bg-black/60 backdrop-blur-sm">
				<div className="text-sm text-white truncate">{title ?? ""}</div>
				<div>
					<button
						aria-label="Close frame"
						onClick={() => (onClose ? onClose() : window.history.back())}
						className="text-white bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded"
					>
						Close
					</button>
				</div>
			</div>
			<iframe
				src={url}
				title={title ?? url}
				className="flex-1 w-full h-full border-0 bg-white"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
			/>
		</div>
	);
}
