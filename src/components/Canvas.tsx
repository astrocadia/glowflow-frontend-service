import React, { useRef, useEffect, MouseEvent } from "react";

interface CanvasProps {
  width: number;
  height: number;
  cellSize: number;
  color: string;
  onCanvasUpdate: (canvas: string) => void;
  imageData: ImageData;
}

const canvasToHexString = (canvas: HTMLCanvasElement, cellSize: number) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const { width, height } = canvas;

  let hexString = "";

  for (let y = 0; y < height; y++) {
    for (
      let x = y % 2 === 0 ? 0 : width - 1;
      y % 2 === 0 ? x < width : x >= 0;
      y % 2 === 0 ? x++ : x--
    ) {
      const pixelData = ctx.getImageData(x * cellSize, y * cellSize, 1, 1).data;
      const [r, g, b] = pixelData;
      const hexColor = ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1);
      hexString += hexColor;
    }
  }

  return hexString;
};

const Canvas: React.FC<CanvasProps> = ({
  width,
  height,
  cellSize,
  color,
  onCanvasUpdate,
  imageData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawPixel = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string
  ) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  };

  const handleCanvasClick = (event: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellSize);
    const y = Math.floor((event.clientY - rect.top) / cellSize);

    drawPixel(ctx, x, y, color);

    const colorData = canvasToHexString(canvas, cellSize);
    onCanvasUpdate(colorData);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { willReadFrequently: false });
    context?.putImageData(imageData, 0, 0);
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
  }, [width, height, cellSize, imageData]);

  return <canvas ref={canvasRef} onClick={handleCanvasClick} />;
};

export default Canvas;
