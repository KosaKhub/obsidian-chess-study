import { Chessground as ChessgroundApi } from 'chessground';
import { Api } from 'chessground/api';
import { DrawShape } from 'chessground/draw';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

interface BoardPreviewProps {
	fen: string;
	shapes?: DrawShape[];
	boardColor?: 'green' | 'brown';
	orientation?: 'white' | 'black';
}

export const BoardPreview = ({
	fen,
	shapes = [],
	boardColor = 'green',
	orientation = 'white',
}: BoardPreviewProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const [api, setApi] = useState<Api | null>(null);

	// Initialize Chessground once on mount
	useEffect(() => {
		if (!ref.current) return;
		const cg = ChessgroundApi(ref.current, {
			fen,
			orientation,
			viewOnly: true,
			animation: { enabled: true, duration: 100 },
			drawable: { enabled: false, eraseOnClick: false },
		});
		setApi(cg);
		return () => cg.destroy();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Update FEN when navigating
	useEffect(() => {
		api?.set({ fen });
	}, [api, fen]);

	// Update shapes
	useEffect(() => {
		api?.setShapes([...shapes]);
	}, [api, shapes]);

	// Update orientation when flipped
	useEffect(() => {
		api?.set({ orientation });
	}, [api, orientation]);

	return (
		<div
			className={`${boardColor}-board`}
			style={{ width: '100%', height: '100%' }}
		>
			<div ref={ref} style={{ width: '100%', height: '100%' }} />
		</div>
	);
};
